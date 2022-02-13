import { PublicKey } from '@solana/web3.js'
import JSBI from 'jsbi'
import { Currency, CurrencyAmount, Fraction, TradeType, Token as UniToken } from '@uniswap/sdk-core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAllV3Routes } from './useAllV3Routes'
import { usePool } from './usePools'
import { BN } from '@project-serum/anchor'
import { useDerivedSwapInfo } from 'state/swap/hooks'
import { SolanaTickDataProvider } from './useSwapCallback'
import { useSolana } from '@saberhq/use-solana'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { PROGRAM_ID_STR } from 'constants/addresses'
import { CyclosCore, IDL } from 'types/cyclos-core'
import * as anchor from '@project-serum/anchor'
import { Pool } from '@uniswap/v3-sdk'
import usePrevious from './usePrevious'
import { SOL_LOCAL, WSOL_LOCAL } from 'constants/tokens'

export enum V3TradeState {
  LOADING,
  INVALID,
  NO_ROUTE_FOUND,
  VALID,
  SYNCING,
}

export type CysTrade =
  | {
      route: PublicKey
      inputAmount: CurrencyAmount<Currency>
      outputAmount: CurrencyAmount<Currency>
    }
  | null
  | undefined

export interface CyclosTrade {
  state: V3TradeState
  trade: CysTrade
}

/**
 * Returns the best v3 trade for a desired exact input swap
 * @param amountIn the amount to swap in
 * @param currencyOut the desired output currency
 */
export function useBestV3TradeExactIn(
  amountIn?: CurrencyAmount<Currency>,
  currencyOut?: Currency
  // ): { state: V3TradeState; trade: Trade<Currency, Currency, TradeType.EXACT_INPUT> | null } {
): CyclosTrade {
  const { routes, loading: routesLoading } = useAllV3Routes(amountIn?.currency, currencyOut)
  const prevState = usePrevious(routes)
  // console.log(prevState, ' is the previous State')

  // This checks to see if the routes have been updated with newer values
  // by comparing each array value to the previous state.
  const dontRender = useMemo(() => {
    const routesSorted = routes.sort()
    const prevStateSorted = prevState?.sort()
    if (!prevStateSorted) return false
    const changed = routesSorted.map((ele, i) => ele == prevStateSorted[i])
    return changed.every((ele) => ele == true)
  }, [prevState, routes])
  // console.log(dontRender)

  const { connection, wallet } = useSolana()
  const provider = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: true,
  })
  const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)

  // const quotesResults = useSingleContractMultipleData(quoter, 'quoteExactInput', quoteExactInInputs)
  const [amntOut, setAmntOut] = useState<CurrencyAmount<Currency> | null>(null)
  // by default returning route[0] for now since type conflict is there.
  const [bestRoute, setBestRoute] = useState<PublicKey>(routes[0])
  const amntIn = amountIn && new BN(amountIn.numerator[0])

  useEffect(() => {
    if (!amountIn || !currencyOut || !routes || !amntIn) return
    ;(async () => {
      setBestRoute(routes[0])

      let bestAmount: CurrencyAmount<typeof currencyOut> = CurrencyAmount.fromRawAmount(currencyOut, JSBI.BigInt(0))

      try {
        routes.forEach(async (route) => {
          const { tick, sqrtPriceX32, liquidity, token0, token1, fee } = await cyclosCore.account.poolState.fetch(route)

          const t0 = token0.toString() == SOL_LOCAL.address ? new PublicKey(WSOL_LOCAL.address) : token0
          const t1 = token1.toString() == SOL_LOCAL.address ? new PublicKey(WSOL_LOCAL.address) : token1

          const tickDataProvider = new SolanaTickDataProvider(cyclosCore, {
            token0: t0,
            token1: t1,
            fee: fee,
          })

          const pool = new Pool(
            amountIn.currency.wrapped,
            currencyOut.wrapped,
            fee,
            JSBI.BigInt(sqrtPriceX32),
            JSBI.BigInt(liquidity),
            tick,
            tickDataProvider
          )

          const [expectedAmountOut] = await pool.getOutputAmount(
            CurrencyAmount.fromRawAmount(amountIn?.currency?.wrapped, amntIn.toNumber())
          )

          console.log(expectedAmountOut.toSignificant(), fee)
          if (bestAmount.equalTo(bestAmount)) {
            // console.log('initial loop')
            bestAmount = expectedAmountOut
          }
          // If we get a better quote of other pool
          if (expectedAmountOut.lessThan(bestAmount)) {
            // console.log('better route found', route, expectedAmountOut.toSignificant())
            bestAmount = expectedAmountOut
            // console.log(route, ' is the best route now')
            setAmntOut(expectedAmountOut)
            setBestRoute(route)
          } else {
            // Already have the best quote
            // console.log('already is the best route', bestRoute, bestAmount)
            // bestAmount = bestAmount
            setAmntOut(bestAmount)
            // setBestRoute(route)
          }
        })
      } catch (err) {
        console.error('Error', err)
      }
    })()
  }, [dontRender, amountIn?.toSignificant()])

  return useMemo(() => {
    // if (!amountIn || !currencyOut || !routes[0]) {
    if (!amountIn || !currencyOut || !routes[0] || amntOut?.lessThan(new Fraction(0, 1))) {
      // Throw Illiquid error message for negative trades too
      if (amntOut?.lessThan(new Fraction(0, 1))) {
        console.log('Getting -ve price for this trade!')
      }
      return {
        state: V3TradeState.INVALID,
        trade: null,
      }
    }

    if (routesLoading || !amntOut) {
      return {
        state: V3TradeState.LOADING,
        trade: null,
      }
    }
    return {
      state: V3TradeState.VALID,
      trade: {
        route: bestRoute,
        inputAmount: amountIn,
        outputAmount: amntOut,
      },
    }
  }, [amountIn, currencyOut, amntOut, dontRender, routesLoading])
}

// /**
//  * Returns the best v3 trade for a desired exact output swap
//  * @param currencyIn the desired input currency
//  * @param amountOut the amount to swap out
//  */
export function useBestV3TradeExactOut(
  currencyIn?: Currency,
  amountOut?: CurrencyAmount<Currency>
  // ): { state: V3TradeState; trade: Trade<Currency, Currency, TradeType.EXACT_OUTPUT> | null } {
): CyclosTrade {
  const { routes, loading: routesLoading } = useAllV3Routes(amountOut?.currency, currencyIn)
  const prevState = usePrevious(routes)
  // console.log(prevState, ' is the previous State')

  // This checks to see if the routes have been updated with newer values
  // by comparing each array value to the previous state.
  const dontRender = useMemo(() => {
    const routesSorted = routes.sort()
    const prevStateSorted = prevState?.sort()
    if (!prevStateSorted) return false
    const changed = routesSorted.map((ele, i) => ele == prevStateSorted[i])
    return changed.every((ele) => ele == true)
  }, [prevState, routes])
  // console.log(dontRender)

  const { connection, wallet } = useSolana()
  const provider = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: true,
  })
  const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)

  // const quotesResults = useSingleContractMultipleData(quoter, 'quoteExactInput', quoteExactInInputs)
  const [amntOut, setAmntOut] = useState<CurrencyAmount<Currency> | null>(null)
  // by default returning route[0] for now since type conflict is there.
  const [bestRoute, setBestRoute] = useState<PublicKey>(routes[0])
  const amntIn = amountOut && new BN(amountOut.numerator[0])

  useEffect(() => {
    if (!amountOut || !currencyIn || !routes || !amntIn) return
    ;(async () => {
      setBestRoute(routes[0])

      let bestAmount: CurrencyAmount<typeof currencyIn> = CurrencyAmount.fromRawAmount(currencyIn, JSBI.BigInt(0))

      try {
        routes.forEach(async (route) => {
          const { tick, sqrtPriceX32, liquidity, token0, token1, fee } = await cyclosCore.account.poolState.fetch(route)

          const t0 = token0.toString() == SOL_LOCAL.address ? new PublicKey(WSOL_LOCAL.address) : token0
          const t1 = token1.toString() == SOL_LOCAL.address ? new PublicKey(WSOL_LOCAL.address) : token1

          const tickDataProvider = new SolanaTickDataProvider(cyclosCore, {
            token0: t0,
            token1: t1,
            fee: fee,
          })

          const pool = new Pool(
            amountOut.currency.wrapped,
            currencyIn.wrapped,
            fee,
            JSBI.BigInt(sqrtPriceX32),
            JSBI.BigInt(liquidity),
            tick,
            tickDataProvider
          )

          const [expectedAmountOut] = await pool.getInputAmount(
            CurrencyAmount.fromRawAmount(amountOut?.currency?.wrapped, amntIn.toNumber())
          )

          console.log(expectedAmountOut.toSignificant(), fee)
          if (bestAmount.equalTo(bestAmount)) {
            // console.log('initial loop')
            bestAmount = expectedAmountOut
          }
          // If we get a better quote of other pool
          if (expectedAmountOut.lessThan(bestAmount)) {
            // console.log('better route found', route, expectedAmountOut.toSignificant())
            bestAmount = expectedAmountOut
            // console.log(route, ' is the best route now')
            setAmntOut(expectedAmountOut)
            setBestRoute(route)
          } else {
            // Already have the best quote
            // console.log('already is the best route', bestRoute, bestAmount)
            // bestAmount = bestAmount
            setAmntOut(bestAmount)
            // setBestRoute(route)
          }
        })
      } catch (err) {
        console.error('Error', err)
      }
    })()
  }, [dontRender, amountOut?.toSignificant()])

  return useMemo(() => {
    if (!amountOut || !currencyIn || !routes[0] || amntOut?.lessThan(new Fraction(0, 1))) {
      // Throw Illiquid error message for negative trades too
      if (amntOut?.lessThan(new Fraction(0, 1))) {
        console.log('Getting -ve price for this trade')
      }
      return {
        state: V3TradeState.INVALID,
        trade: null,
      }
    }

    if (routesLoading || !amntOut) {
      return {
        state: V3TradeState.LOADING,
        trade: null,
      }
    }
    return {
      state: V3TradeState.VALID,
      trade: {
        route: bestRoute,
        inputAmount: amntOut,
        outputAmount: amountOut,
      },
    }
  }, [amountOut, currencyIn, amntOut, dontRender, routesLoading])
  //   const quoter = useV3Quoter()
  //   const { routes, loading: routesLoading } = useAllV3Routes(currencyIn, amountOut?.currency)

  //   const quoteExactOutInputs = useMemo(() => {
  //     return routes.map((route) => [
  //       encodeRouteToPath(route, true),
  //       amountOut ? `0x${amountOut.quotient.toString(16)}` : undefined,
  //     ])
  //   }, [amountOut, routes])

  //   const quotesResults = useSingleContractMultipleData(quoter, 'quoteExactOutput', quoteExactOutInputs)

  //   return useMemo(() => {
  //     if (!amountOut || !currencyIn || quotesResults.some(({ valid }) => !valid)) {
  //       return {
  //         state: V3TradeState.INVALID,
  //         trade: null,
  //       }
  //     }

  //     if (routesLoading || quotesResults.some(({ loading }) => loading)) {
  //       return {
  //         state: V3TradeState.LOADING,
  //         trade: null,
  //       }
  //     }

  //     const { bestRoute, amountIn } = quotesResults.reduce(
  //       (currentBest: { bestRoute: Route<Currency, Currency> | null; amountIn: BigNumber | null }, { result }, i) => {
  //         if (!result) return currentBest

  //         if (currentBest.amountIn === null) {
  //           return {
  //             bestRoute: routes[i],
  //             amountIn: result.amountIn,
  //           }
  //         } else if (currentBest.amountIn.gt(result.amountIn)) {
  //           return {
  //             bestRoute: routes[i],
  //             amountIn: result.amountIn,
  //           }
  //         }

  //         return currentBest
  //       },
  //       {
  //         bestRoute: null,
  //         amountIn: null,
  //       }
  //     )

  //     if (!bestRoute || !amountIn) {
  //       return {
  //         state: V3TradeState.NO_ROUTE_FOUND,
  //         trade: null,
  //       }
  //     }

  //     const isSyncing = quotesResults.some(({ syncing }) => syncing)

  //     return {
  //       state: isSyncing ? V3TradeState.SYNCING : V3TradeState.VALID,
  //       trade: Trade.createUncheckedTrade({
  //         route: bestRoute,
  //         tradeType: TradeType.EXACT_OUTPUT,
  //         inputAmount: CurrencyAmount.fromRawAmount(currencyIn, amountIn.toString()),
  //         outputAmount: amountOut,
  //       }),
  //     }
  //   }, [amountOut, currencyIn, quotesResults, routes, routesLoading])
}
