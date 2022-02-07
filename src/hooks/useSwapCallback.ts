import { BigNumber } from '@ethersproject/bignumber'
import JSBI from 'jsbi'
import {
  generateBitmapWord,
  nextInitializedBit,
  Pool,
  PoolVars,
  SwapRouter,
  TickDataProvider,
  tickPosition,
  Trade as V3Trade,
  u32ToSeed,
} from '@uniswap/v3-sdk'
import { Currency, Percent, TradeType, Token as UniToken, BigintIsh, CurrencyAmount } from '@uniswap/sdk-core'
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
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { CysTrade } from './useBestV3Trade'
import { useSolana } from '@saberhq/use-solana'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { BN } from '@project-serum/anchor'
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { u16ToSeed } from 'state/mint/v3/utils'
import { BITMAP_SEED, OBSERVATION_SEED, TICK_SEED, WSOL_LOCAL } from 'constants/tokens'
import { useSwapState } from 'state/swap/hooks'
import { useCurrency } from './Tokens'

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

  const { connection, wallet, providerMut } = useSolana()
  const {
    INPUT: { currencyId: inputCurrencyId },
    OUTPUT: { currencyId: outputCurrencyId },
  } = useSwapState()
  const inputCurrency = useCurrency(inputCurrencyId)
  const outputCurrency = useCurrency(outputCurrencyId)

  if (!trade || !trade.route || !wallet?.publicKey || !inputCurrency || !outputCurrency) {
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
    const { observationIndex, observationCardinalityNext, tick, sqrtPriceX32, liquidity, token0, token1, fee } =
      await cyclosCore.account.poolState.fetch(pool)

    console.log('token0', token0.toString(), 'token1', token1.toString(), 'tick', tick)

    // TODO replace hardcoded fee and token decimal places
    // const fee = 500
    const tickDataProvider = new SolanaTickDataProvider(cyclosCore, {
      token0,
      token1,
      fee,
    })

    const uniToken0 = inputCurrency?.wrapped
    const uniToken1 = outputCurrency?.wrapped

    // output is one tick behind actual (8 instead of 9)
    const uniPoolA = new Pool(
      uniToken0,
      uniToken1,
      fee,
      JSBI.BigInt(sqrtPriceX32),
      JSBI.BigInt(liquidity),
      tick,
      tickDataProvider
    )

    const amountIn = new BN(trade?.inputAmount.numerator[0])
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

    // price = reserves_1 / reserves_0
    // token 0 -> 1 (USDT -> USDC), price down
    // token 1 -> 0 (USDC -> USDT), price up

    const inputToken = new PublicKey((trade.inputAmount.currency as UniToken).address)
    const [inputTokenAccount, outputTokenAccount, inputVault, outputVault, zeroForOne] = inputToken.equals(token0)
      ? [minterWallet0, minterWallet1, vault0, vault1, true]
      : [minterWallet1, minterWallet0, vault1, vault0, false]

    console.log('zero for one', zeroForOne)
    const [_expectedAmountOut, _expectedNewPool, swapAccounts] = await uniPoolA.getOutputAmount(
      CurrencyAmount.fromRawAmount(zeroForOne ? uniToken0 : uniToken1, amountIn.toNumber())
    )
    console.log('got swap accounts', swapAccounts, 'expected amount out', _expectedAmountOut)

    const deadline = new BN(Date.now() / 1000 + 100_000)

    const tx = new Transaction()

    // 1. Check if respective ATA's accounts.
    // Check for all mints except SOL, as wrap and unwrap is used for SOL
    ;[inputCurrency, outputCurrency].forEach(async (currency) => {
      if (currency.symbol != 'SOL') {
        const ata = await Token.getAssociatedTokenAddress(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          new PublicKey(currency.wrapped.address),
          signer
        )
        const accountInfo = await connection.getAccountInfo(ata)

        if (!accountInfo) {
          console.log(`Creating ATA for ${currency.name}`)
          tx.instructions.push(
            Token.createAssociatedTokenAccountInstruction(
              ASSOCIATED_TOKEN_PROGRAM_ID,
              TOKEN_PROGRAM_ID,
              new PublicKey(currency.wrapped.address),
              ata,
              signer,
              signer
            )
          )
        }
      }
    })

    // 2. Wrap and Unwrap native SOL is one of the input tokens is SOL
    if (inputCurrency.symbol == 'SOL' || outputCurrency.symbol == 'SOL') {
      console.log(`Wrapping native SOL`)

      // WRAP NATIVE SOL
      const wrappedSolPubkey = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        new PublicKey(WSOL_LOCAL.address),
        signer
      )
      tx.add(
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          new PublicKey(WSOL_LOCAL.address),
          wrappedSolPubkey,
          signer,
          signer
        )
      )
      // If swapping from SOL
      if (inputCurrency.symbol == 'SOL') {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: signer,
            toPubkey: wrappedSolPubkey,
            lamports: amountIn.toNumber(),
          })
        )
      }
      // Initialize the account.
      tx.add(
        Token.createInitAccountInstruction(
          TOKEN_PROGRAM_ID,
          new PublicKey(WSOL_LOCAL.address),
          wrappedSolPubkey,
          signer
        )
      )
    }

    const ix = cyclosCore.instruction.exactInput(deadline, amountIn, new BN(0), Buffer.from([swapAccounts.length]), {
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
        ...swapAccounts,
      ],
    })

    tx.add(ix)

    // UNWRAP NATIVE SOL
    if (inputCurrency.symbol == 'SOL' || outputCurrency.symbol == 'SOL') {
      console.log(`Unwrapping native SOL`)

      const wrappedSolPubkey = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        new PublicKey(WSOL_LOCAL.address),
        signer
      )
      tx.add(Token.createCloseAccountInstruction(TOKEN_PROGRAM_ID, wrappedSolPubkey, signer, signer, []))
    }

    tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash
    tx.feePayer = signer

    const str = tx.serializeMessage().toString('base64')
    console.log(`https://explorer.solana.com/tx/inspector?message=${encodeURIComponent(str)}`)

    await wallet?.signTransaction(tx)
    const hash = await providerMut?.send(tx)

    console.log('swap hash', hash)
    return hash?.signature ?? '' // This should not be the case. Check types, should not get empty string here
  }
  return { state: SwapCallbackState.VALID, callback, error: null }
}

function mostSignificantBit(x: BN) {
  return x.bitLength() - 1
}

function leastSignificantBit(x: BN) {
  return x.zeroBits()
}

export class SolanaTickDataProvider implements TickDataProvider {
  program: anchor.Program<CyclosCore>
  pool: PoolVars

  constructor(program: anchor.Program<CyclosCore>, pool: PoolVars) {
    this.program = program
    this.pool = pool
  }

  async getTick(tick: number): Promise<{ liquidityNet: BigintIsh }> {
    const tickState = (
      await PublicKey.findProgramAddress(
        [
          TICK_SEED,
          this.pool.token0.toBuffer(),
          this.pool.token1.toBuffer(),
          u32ToSeed(this.pool.fee),
          u32ToSeed(tick),
        ],
        this.program.programId
      )
    )[0]

    const { liquidityNet } = await this.program.account.tickState.fetch(tickState)
    return {
      liquidityNet: liquidityNet.toString(),
    }
  }

  async getTickAddress(tick: number): Promise<anchor.web3.PublicKey> {
    return (
      await PublicKey.findProgramAddress(
        [
          TICK_SEED,
          this.pool.token0.toBuffer(),
          this.pool.token1.toBuffer(),
          u32ToSeed(this.pool.fee),
          u32ToSeed(tick),
        ],
        this.program.programId
      )
    )[0]
  }

  async nextInitializedTickWithinOneWord(
    tick: number,
    lte: boolean,
    tickSpacing: number
  ): Promise<[number, boolean, number, number, PublicKey]> {
    // TODO optimize function. Currently bitmaps are repeatedly fetched, even if two ticks are on the same bitmap
    let compressed = Number(BigInt(tick) / BigInt(tickSpacing))
    // console.log('tick', tick, 'spacing', tickSpacing, 'compressed', compressed, 'lte', lte)
    if (tick < 0 && tick % tickSpacing !== 0) {
      // console.log('deducting from compressed.')
      compressed -= 1
    }
    if (!lte) {
      compressed += 1
    }

    const { wordPos, bitPos } = tickPosition(compressed)

    const bitmapState = (
      await PublicKey.findProgramAddress(
        [
          BITMAP_SEED,
          this.pool.token0.toBuffer(),
          this.pool.token1.toBuffer(),
          u32ToSeed(this.pool.fee),
          u16ToSeed(wordPos),
        ],
        this.program.programId
      )
    )[0]

    let nextBit = lte ? 0 : 255
    let initialized = false
    try {
      const { word: wordArray } = await this.program.account.tickBitmapState.fetch(bitmapState)
      const word = generateBitmapWord(wordArray)
      const nextInitBit = nextInitializedBit(word, bitPos, lte)
      nextBit = nextInitBit.next
      initialized = nextInitBit.initialized
    } catch (error) {
      console.log('bitmap account doesnt exist, using default nextbit', nextBit)
    }
    const nextTick = (wordPos * 256 + nextBit) * tickSpacing
    // console.log('returning next tick', nextTick)
    return [nextTick, initialized, wordPos, bitPos, bitmapState]
  }
}
