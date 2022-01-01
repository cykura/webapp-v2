import { BigNumber } from '@ethersproject/bignumber'
import { t } from '@lingui/macro'
import { SwapRouter, Trade as V3Trade } from '@uniswap/v3-sdk'
import { Currency, Percent, TradeType } from '@uniswap/sdk-core'
import { useMemo } from 'react'
import { SWAP_ROUTER_ADDRESSES } from '../constants/addresses'
import { calculateGasMargin } from '../utils/calculateGasMargin'
import { useTransactionAdder } from '../state/transactions/hooks'
import { isAddress, shortenAddress } from '../utils'
import isZero from '../utils/isZero'
import { useActiveWeb3ReactSol } from './web3'
import { SignatureData } from './useERC20Permit'
import useTransactionDeadline from './useTransactionDeadline'

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
  recipientAddress: string | null, // the address of the recipient of the trade, or null if swap should be returned to sender
  signatureData: SignatureData | null | undefined
): SwapCall[] {
  const { account, chainId, librarySol } = useActiveWeb3ReactSol()
  const recipient = recipientAddress ?? account
  const deadline = useTransactionDeadline()

  return useMemo(() => {
    if (!trade || !recipient || !librarySol || !account || !chainId || !deadline) return []
    const swapRouterAddress = chainId ? SWAP_ROUTER_ADDRESSES[chainId] : undefined
    if (!swapRouterAddress) return []

    const { value, calldata } = SwapRouter.swapCallParameters(trade, {
      recipient,
      slippageTolerance: allowedSlippage,
      deadline: deadline.toString(),
      ...(signatureData
        ? {
            inputTokenPermit:
              'allowed' in signatureData
                ? {
                    expiry: signatureData.deadline,
                    nonce: signatureData.nonce,
                    s: signatureData.s,
                    r: signatureData.r,
                    v: signatureData.v as any,
                  }
                : {
                    deadline: signatureData.deadline,
                    amount: signatureData.amount,
                    s: signatureData.s,
                    r: signatureData.r,
                    v: signatureData.v as any,
                  },
          }
        : {}),
    })
    return [
      {
        address: swapRouterAddress,
        calldata,
        value,
      },
    ]
  }, [account, allowedSlippage, chainId, deadline, librarySol, recipient, signatureData, trade])
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
    case 'UniswapV2Router: EXPIRED':
      return t`The transaction could not be sent because the deadline has passed. Please check that your transaction deadline is not too low.`
    case 'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT':
    case 'UniswapV2Router: EXCESSIVE_INPUT_AMOUNT':
      return t`This transaction will not succeed either due to price movement or fee on transfer. Try increasing your slippage tolerance.`
    case 'TransferHelper: TRANSFER_FROM_FAILED':
      return t`The input token cannot be transferred. There may be an issue with the input token.`
    case 'UniswapV2: TRANSFER_FAILED':
      return t`The output token cannot be transferred. There may be an issue with the output token.`
    case 'UniswapV2: K':
      return t`The Uniswap invariant x*y=k was not satisfied by the swap. This usually means one of the tokens you are swapping incorporates custom behavior on transfer.`
    case 'Too little received':
    case 'Too much requested':
    case 'STF':
      return t`This transaction will not succeed due to price movement. Try increasing your slippage tolerance. Note: fee on transfer and rebase tokens are incompatible with Uniswap V3.`
    case 'TF':
      return t`The output token cannot be transferred. There may be an issue with the output token. Note: fee on transfer and rebase tokens are incompatible with Uniswap V3.`
    default:
      if (reason?.indexOf('undefined is not an object') !== -1) {
        console.error(error, reason)
        return t`An error occurred when trying to execute this swap. You may need to increase your slippage tolerance. If that does not work, there may be an incompatibility with the token you are trading. Note: fee on transfer and rebase tokens are incompatible with Uniswap V3.`
      }
      return t`Unknown error${
        reason ? `: "${reason}"` : ''
      }. Try increasing your slippage tolerance. Note: fee on transfer and rebase tokens are incompatible with Uniswap V3.`
  }
}

// returns a function that will execute a swap, if the parameters are all valid
// and the user has approved the slippage adjusted input amount for the trade
export function useSwapCallback(
  trade: V3Trade<Currency, Currency, TradeType> | undefined, // trade to execute, required
  allowedSlippage: Percent, // in bips
  recipientAddress: string | null, // the address of the recipient of the trade, or null if swap should be returned to sender
  signatureData: SignatureData | undefined | null
): { state: SwapCallbackState; callback: null | (() => Promise<string>); error: string | null } {
  const { account, chainId, librarySol } = useActiveWeb3ReactSol()

  const swapCalls = useSwapCallArguments(trade, allowedSlippage, recipientAddress, signatureData)

  const addTransaction = useTransactionAdder()

  const recipient = recipientAddress ?? account

  return useMemo(() => {
    if (!trade || !librarySol || !account || !chainId) {
      return { state: SwapCallbackState.INVALID, callback: null, error: 'Missing dependencies' }
    }
    if (!recipient) {
      if (recipientAddress !== null) {
        return { state: SwapCallbackState.INVALID, callback: null, error: 'Invalid recipient' }
      } else {
        return { state: SwapCallbackState.LOADING, callback: null, error: null }
      }
    }

    return {
      state: SwapCallbackState.VALID,
      callback: async function onSwap(): Promise<string> {
        const estimatedCalls: SwapCallEstimate[] = await Promise.all(
          swapCalls.map((call) => {
            const { address, calldata, value } = call

            const tx =
              !value || isZero(value)
                ? { from: account, to: address, data: calldata }
                : {
                    from: account,
                    to: address,
                    data: calldata,
                    value,
                  }

            return librarySol
              ?.estimateGas(tx)
              .then((gasEstimate: any) => {
                return {
                  call,
                  gasEstimate,
                }
              })
              .catch((gasError: any) => {
                console.debug('Gas estimate failed, trying eth_call to extract error', call)

                return librarySol
                  ?.call(tx)
                  .then((result: any) => {
                    console.debug('Unexpected successful call after failed estimate gas', call, gasError, result)
                    return { call, error: new Error('Unexpected issue with estimating the gas. Please try again.') }
                  })
                  .catch((callError: any) => {
                    console.debug('Call threw error', call, callError)
                    return { call, error: new Error(swapErrorToUserReadableMessage(callError)) }
                  })
              })
          })
        )

        // a successful estimation is a bignumber gas estimate and the next call is also a bignumber gas estimate
        let bestCallOption: SuccessfulCall | SwapCallEstimate | undefined = estimatedCalls.find(
          (el, ix, list): el is SuccessfulCall =>
            'gasEstimate' in el && (ix === list.length - 1 || 'gasEstimate' in list[ix + 1])
        )

        // check if any calls errored with a recognizable error
        if (!bestCallOption) {
          const errorCalls = estimatedCalls.filter((call): call is FailedCall => 'error' in call)
          if (errorCalls.length > 0) throw errorCalls[errorCalls.length - 1].error
          const firstNoErrorCall = estimatedCalls.find<SwapCallEstimate>(
            (call): call is SwapCallEstimate => !('error' in call)
          )
          if (!firstNoErrorCall) throw new Error('Unexpected error. Could not estimate gas for the swap.')
          bestCallOption = firstNoErrorCall
        }

        const {
          call: { address, calldata, value },
        } = bestCallOption

        return librarySol
          ?.getSigner()
          .sendTransaction({
            from: account,
            to: address,
            data: calldata,
            // let the wallet try if we can't estimate the gas
            ...('gasEstimate' in bestCallOption ? { gasLimit: calculateGasMargin(bestCallOption.gasEstimate) } : {}),
            ...(value && !isZero(value) ? { value } : {}),
          })
          .then((response: any) => {
            const inputSymbol = trade.inputAmount.currency.symbol
            const outputSymbol = trade.outputAmount.currency.symbol
            const inputAmount = trade.inputAmount.toSignificant(4)
            const outputAmount = trade.outputAmount.toSignificant(4)

            const base = `Swap ${inputAmount} ${inputSymbol} for ${outputAmount} ${outputSymbol}`
            const withRecipient =
              recipient === account
                ? base
                : `${base} to ${
                    recipientAddress && isAddress(recipientAddress)
                      ? shortenAddress(recipientAddress)
                      : recipientAddress
                  }`

            addTransaction(response, {
              summary: withRecipient,
            })

            return response.hash
          })
          .catch((error: any) => {
            // if the user rejected the tx, pass this along
            if (error?.code === 4001) {
              throw new Error('Transaction rejected.')
            } else {
              // otherwise, the error was unexpected and we need to convey that
              console.error(`Swap failed`, error, address, calldata, value)

              throw new Error(`Swap failed: ${swapErrorToUserReadableMessage(error)}`)
            }
          })
      },
      error: null,
    }
  }, [trade, librarySol, account, chainId, recipient, recipientAddress, swapCalls, addTransaction])
}
