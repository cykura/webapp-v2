import { BigNumber } from '@ethersproject/bignumber'
import { SwapRouter, Trade as V3Trade, u32ToSeed } from '@uniswap/v3-sdk'
import { Currency, Percent, TradeType, Token as UniToken } from '@uniswap/sdk-core'
import * as anchor from '@project-serum/anchor'
import idl from '../constants/cyclos-core.json'
import { useMemo } from 'react'
import { CyclosCore, IDL } from 'types/cyclos-core'
import { PROGRAM_ID_STR, SWAP_ROUTER_ADDRESSES } from '../constants/addresses'
import { calculateGasMargin } from '../utils/calculateGasMargin'
import { useTransactionAdder } from '../state/transactions/hooks'
import { isAddress, shortenAddress } from '../utils'
import isZero from '../utils/isZero'
import { useActiveWeb3ReactSol } from './web3'
import useTransactionDeadline from './useTransactionDeadline'
import { PublicKey } from '@solana/web3.js'
import { CysTrade } from './useBestV3Trade'
import { useSolana } from '@saberhq/use-solana'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { BN } from '@project-serum/anchor'
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { u16ToSeed } from 'state/mint/v3/utils'
import { BITMAP_SEED, OBSERVATION_SEED, TICK_SEED } from 'constants/tokens'

enum SwapCallbackState {
  INVALID,
  LOADING,
  VALID,
}

interface SwapCall {
  address: string
  calldata: string
  value: string
}

interface SwapCallEstimate {
  call: SwapCall
}

interface SuccessfulCall extends SwapCallEstimate {
  call: SwapCall
  gasEstimate: BigNumber
}

interface FailedCall extends SwapCallEstimate {
  call: SwapCall
  error: Error
}

/**
 * Returns the swap calls that can be used to make the trade
 * @param trade trade to execute
 * @param allowedSlippage user allowed slippage
 * @param recipientAddress the address of the recipient of the swap output
 * @param signatureData the signature data of the permit of the input token amount, if available
 */
function useSwapCallArguments(
  trade: V3Trade<Currency, Currency, TradeType> | undefined, // trade to execute, required
  allowedSlippage: Percent, // in bips
  recipientAddress: string | null // the address of the recipient of the trade, or null if swap should be returned to sender
  // signatureData: SignatureData | null | undefined
): SwapCall[] {
  const { account, chainId, librarySol } = useActiveWeb3ReactSol()
  const recipient = recipientAddress ?? account
  const deadline = useTransactionDeadline()

  return []
  // return useMemo(() => {
  //   if (!trade || !recipient || !librarySol || !account || !chainId || !deadline) return []
  //   const swapRouterAddress = chainId ? SWAP_ROUTER_ADDRESSES[chainId] : undefined
  //   if (!swapRouterAddress) return []

  //   const { value, calldata } = SwapRouter.swapCallParameters(trade, {
  //     recipient,
  //     slippageTolerance: allowedSlippage,
  //     deadline: deadline.toString(),
  //     ...(signatureData
  //       ? {
  //           inputTokenPermit:
  //             'allowed' in signatureData
  //               ? {
  //                   expiry: signatureData.deadline,
  //                   nonce: signatureData.nonce,
  //                   s: signatureData.s,
  //                   r: signatureData.r,
  //                   v: signatureData.v as any,
  //                 }
  //               : {
  //                   deadline: signatureData.deadline,
  //                   amount: signatureData.amount,
  //                   s: signatureData.s,
  //                   r: signatureData.r,
  //                   v: signatureData.v as any,
  //                 },
  //         }
  //       : {}),
  //   })
  //   return [
  //     {
  //       address: swapRouterAddress,
  //       calldata,
  //       value,
  //     },
  //   ]
  // }, [account, allowedSlippage, chainId, deadline, librarySol, recipient, signatureData, trade])
}

/**
 * This is hacking out the revert reason from the ethers provider thrown error however it can.
 * This object seems to be undocumented by ethers.
 * @param error an error from the ethers provider
 */
function swapErrorToUserReadableMessage(error: any): string {
  let reason: string | undefined
  while (Boolean(error)) {
    reason = error.reason ?? error.message ?? reason
    error = error.error ?? error.data?.originalError
  }

  if (reason?.indexOf('execution reverted: ') === 0) reason = reason.substr('execution reverted: '.length)

  switch (reason) {
    case 'CyclosV2Router: EXPIRED':
      return 'The transaction could not be sent because the deadline has passed. Please check that your transaction deadline is not too low.'
    case 'CyclosV2Router: INSUFFICIENT_OUTPUT_AMOUNT':
    case 'CyclosV2Router: EXCESSIVE_INPUT_AMOUNT':
      return 'This transaction will not succeed either due to price movement or fee on transfer. Try increasing your slippage tolerance.'
    case 'TransferHelper: TRANSFER_FROM_FAILED':
      return 'The input token cannot be transferred. There may be an issue with the input token.'
    case 'CyclosV2: TRANSFER_FAILED':
      return 'The output token cannot be transferred. There may be an issue with the output token.'
    case 'CyclosV2: K':
      return 'The invariant x*y=k was not satisfied by the swap. This usually means one of the tokens you are swapping incorporates custom behavior on transfer.'
    case 'Too little received':
    case 'Too much requested':
    case 'STF':
      return 'This transaction will not succeed due to price movement. Try increasing your slippage tolerance. Note: fee on transfer and rebase tokens are incompatible.'
    case 'TF':
      return 'The output token cannot be transferred. There may be an issue with the output token. Note: fee on transfer and rebase tokens are incompatible.'
    default:
      if (reason?.indexOf('undefined is not an object') !== -1) {
        console.error(error, reason)
        return 'An error occurred when trying to execute this swap. You may need to increase your slippage tolerance. If that does not work, there may be an incompatibility with the token you are trading. Note: fee on transfer and rebase tokens are incompatible.'
      }
      return `Unknown error${
        reason ? `: "${reason}"` : ''
      }. Try increasing your slippage tolerance. Note: fee on transfer and rebase tokens are incompatible`
  }
}

// returns a function that will execute a swap, if the parameters are all valid
// and the user has approved the slippage adjusted input amount for the trade
export function useSwapCallback(
  trade: CysTrade, // trade to execute, required
  allowedSlippage: Percent, // in bips
  recipientAddress: string | null // the address of the recipient of the trade, or null if swap should be returned to sender
): { state: SwapCallbackState; callback: null | (() => Promise<string>); error: string | null } {
  // TODO fix output token address in trade- currently it's the same as input token address
  // console.log('building callback for', trade)

  const { connection, wallet } = useSolana()

  if (!trade || !trade.route || !wallet?.publicKey) {
    return { state: SwapCallbackState.INVALID, callback: null, error: 'Missing dependencies' }
  }

  const provider = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: true,
  })
  const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)
  const callback = async () => {
    const signer = wallet.publicKey!
    const pool = trade.route

    // Find bitmap and tick accounts required to consume the input amount
    // 1. Find current tick from pool account
    // 2. Find swap direction
    // 3. Formula to know if a tick is consumed completely
    const { observationIndex, observationCardinalityNext, tick, token0, token1 } =
      await cyclosCore.account.poolState.fetch(pool)
    console.log('token0', token0.toString(), 'token1', token1.toString())

    console.log('input amount', trade?.inputAmount)
    const amountIn = new BN(trade?.inputAmount.numerator[0])
    console.log('amount in', amountIn.toNumber())
    const [factoryState, factoryStateBump] = await PublicKey.findProgramAddress([], cyclosCore.programId)

    const minterWallet0 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token0,
      signer,
      true
    )
    const minterWallet1 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token1,
      signer,
      true
    )
    const vault0 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token0,
      pool,
      true
    )
    const vault1 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token1,
      pool,
      true
    )
    const latestObservationState = (
      await PublicKey.findProgramAddress(
        [OBSERVATION_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(500), u16ToSeed(observationIndex)],
        cyclosCore.programId
      )
    )[0]
    const nextObservationState = (
      await PublicKey.findProgramAddress(
        [
          OBSERVATION_SEED,
          token0.toBuffer(),
          token1.toBuffer(),
          u32ToSeed(500),
          u16ToSeed((observationIndex + 1) % observationCardinalityNext),
        ],
        cyclosCore.programId
      )
    )[0]

    // must pass the bitmap for current pool price, plus additional bitmaps until an active tick
    // is encountered
    const bitmapAccounts = []
    // loop until initialized tick found
    // assume ticks are not crossed. Just valid bitmap must be passed

    // TODO support other spacings
    // currently just 10 spacing supported for 0.05% fee tier
    let wordPos = Math.floor(tick / 10) >> 8
    let bitPos = Math.abs(Math.floor(tick / 10)) % 256
    let next: number | undefined
    let currentBitmap: PublicKey | undefined
    // price = reserves_1 / reserves_0
    // token 0 -> 1 (USDT -> USDC), price down
    // token 1 -> 0 (USDC -> USDT), price up

    const inputToken = new PublicKey((trade.inputAmount.currency as UniToken).address)
    const [inputTokenAccount, outputTokenAccount, inputVault, outputVault, zeroForOne] = inputToken.equals(token0)
      ? [minterWallet0, minterWallet1, vault0, vault1, true]
      : [minterWallet1, minterWallet0, vault1, vault0, false]

    let initialized = false
    while (!initialized) {
      console.log('checking in word', wordPos)
      // bitmap containing current tick
      currentBitmap = (
        await PublicKey.findProgramAddress(
          [BITMAP_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(500), u16ToSeed(wordPos)],
          cyclosCore.programId
        )
      )[0]
      bitmapAccounts.push(currentBitmap)
      console.log('current tick bitmap', currentBitmap.toString())

      console.log('tick', tick, 'word pos', wordPos, 'bit pos', bitPos)
      const bitmapData = await cyclosCore.account.tickBitmapState.fetch(currentBitmap)
      console.log('current bitmap', bitmapData.word) // [u64; 4]

      let word = new BN(0)
      for (let i = 0; i < bitmapData.word.length; i++) {
        console.log('word', i, bitmapData.word[i].toString())
        word = word.add(bitmapData.word[i].shln(64 * i))
      }
      console.log('got word', word.toString(), 'bit length', word.bitLength())
      console.log('zero for one', zeroForOne)
      if (zeroForOne) {
        // get the next active tick less than or equal to the current tick
        const mask = new BN(1).shln(bitPos).subn(1).add(new BN(1).shln(bitPos))
        const masked = word.and(mask)
        initialized = !masked.eqn(0)
        next = -(initialized ? bitPos - mostSignificantBit(masked) : bitPos)
        if (!initialized) {
          wordPos -= 1 // look in the previous bitmap
          bitPos = 255
        }
      } else {
        // get the next active tick greater than the current tick
        const mask = new BN(1).shln(bitPos).subn(1).notn(256)
        const masked = word.and(mask)
        initialized = !masked.eqn(0)
        next = initialized ? leastSignificantBit(masked) - bitPos : 255 - bitPos
        if (!initialized) {
          wordPos += 1 // look in the next bitmap
          bitPos = 0 // TODO handle equal to condition for bitmaps ahead of current price bitmap
        }
      }
      console.log('initialized', initialized, 'next', next)
    }

    if (next) {
      const nextTick = (wordPos << 8) + next
      console.log('word pos', wordPos, 'bit pos', bitPos, 'got next tick', nextTick)
    }

    if (!currentBitmap) {
      return ''
    }

    // TODO support swaps where ticks are flipped
    // flipped tick accounts must be passed

    // const [tickState, tickStateBump] = await PublicKey.findProgramAddress(
    //   [TICK_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(500), u32ToSeed(tick)],
    //   cyclosCore.programId
    // )
    // try {
    //   // no account for tick = 0. Tick account is needed only when price moves past an active tick
    //   const tickData = await cyclosCore.account.tickState.fetch(tickState)
    //   console.log('got tick account', tickData)
    // } catch (error) {
    //   console.error('failed to get tick account', error)
    // }

    // console.log('minter ac 0', minterWallet0.toString())
    // console.log('minter ac 1', minterWallet1.toString())
    // console.log('vault 0', vault0.toString())
    // console.log('vault 1', vault1.toString())
    const deadline = new BN(Date.now() / 1000 + 100_000)
    const hash = await cyclosCore.rpc.exactInput(deadline, amountIn, new BN(0), Buffer.from([bitmapAccounts.length]), {
      accounts: {
        signer,
        factoryState,
        inputTokenAccount,
        coreProgram: cyclosCore.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      remainingAccounts: [
        {
          pubkey: pool,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: outputTokenAccount,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: inputVault,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: outputVault,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: latestObservationState,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: nextObservationState,
          isSigner: false,
          isWritable: true,
        },
        ...bitmapAccounts.map((bitmapAc) => {
          return {
            pubkey: bitmapAc,
            isSigner: false,
            isWritable: true,
          }
        }),
        // {
        //   pubkey: tickState,
        //   isSigner: false,
        //   isWritable: true,
        // },
      ],
    })

    console.log('swap hash', hash)
    return hash
  }
  return { state: SwapCallbackState.VALID, callback, error: null }
}

function mostSignificantBit(x: BN) {
  return x.bitLength() - 1
}

function leastSignificantBit(x: BN) {
  return x.zeroBits()
}
