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
      route: PublicKey | null
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
  const [amountOut, setAmountOut] = useState<CurrencyAmount<Currency> | null>(null)
  const [bestRoute, setBestRoute] = useState<PublicKey | null>(null)

  useEffect(() => {
    if (!amountIn || !currencyOut || !routes || amountIn.currency.wrapped.address == currencyOut.wrapped.address) {
      return
    }
    ;(async () => {
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
            CurrencyAmount.fromFractionalAmount(amountIn?.currency?.wrapped, amountIn.numerator, amountIn.denominator)
          )
          // console.log(expectedAmountOut.toSignificant(), ' is coming from the calculation')

          // console.log(expectedAmountOut.toSignificant(), fee)
          if (bestAmount.equalTo(bestAmount)) {
            // console.log('initial loop')
            bestAmount = expectedAmountOut
            setBestRoute(route)
          }
          // If we get a better quote of other pool
          if (expectedAmountOut.lessThan(bestAmount)) {
            bestAmount = expectedAmountOut
            setAmountOut(expectedAmountOut)
            setBestRoute(route)
          } else {
            // Already have the best quote
            setAmountOut(bestAmount)
          }
        })
      } catch (err) {
        console.error('Error', err)
      }
    })()
  }, [dontRender, amountIn?.toSignificant(), currencyOut])

  return useMemo(() => {
    // console.log(
    //   `TradeIn ${bestRoute?.toString()} inputAmount ${amountIn?.toSignificant()} outputAmount ${amountOut?.toSignificant()}`
    // )
    // console.log(
    //   amountIn?.toSignificant(),
    //   currencyOut?.name,
    //   ...routes.map((r) => r.toString()),
    //   amountOut?.toSignificant()
    // )
    // if (!amountIn || !currencyOut || !routes[0]) {
    if (!amountIn || !currencyOut || !routes[0]) {
      // // Throw Illiquid error message for negative trades too
      // if (amountOut?.lessThan(new Fraction(0, 1))) {
      //   console.log('Getting -ve price for this trade!', amountOut.toSignificant())
      // }
      // console.log('INVALID TRADE', ...routes.map((r) => r.toString()))
      return {
        state: V3TradeState.INVALID,
        trade: null,
      }
    }

    if (routesLoading || !amountOut) {
      // console.log('LOADING TRADE')
      return {
        state: V3TradeState.LOADING,
        trade: null,
      }
    }
    // console.log('FOUND A VALID TRADE?')
    return {
      state: V3TradeState.VALID,
      trade: {
        route: bestRoute,
        inputAmount: amountIn,
        outputAmount: amountOut,
      },
    }
  }, [amountIn, currencyOut, amountOut, dontRender, routesLoading])
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
  }, [prevState, routes, currencyIn?.wrapped.address, amountOut?.toSignificant()])
  // console.log(dontRender)

  const { connection, wallet } = useSolana()
  const provider = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: true,
  })
  const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)

  // const quotesResults = useSingleContractMultipleData(quoter, 'quoteExactInput', quoteExactInInputs)
  const [amountIn, setAmountIn] = useState<CurrencyAmount<Currency> | null>(null)
  const [bestRoute, setBestRoute] = useState<PublicKey | null>(null)

  useEffect(() => {
    if (!amountOut || !currencyIn || !routes || currencyIn.wrapped.address == amountOut?.currency.wrapped.address) {
      return
    }
    ;(async () => {
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

          const [expectedAmountIn] = await pool.getInputAmount(
            CurrencyAmount.fromFractionalAmount(
              amountOut?.currency?.wrapped,
              amountOut.numerator,
              amountOut.denominator
            )
          )

          // console.log(expectedAmountIn.toSignificant(), fee)
          if (bestAmount.equalTo(bestAmount)) {
            // console.log('initial loop')
            bestAmount = expectedAmountIn
            setBestRoute(route)
          }
          // If we get a better quote of other pool
          if (expectedAmountIn.lessThan(bestAmount)) {
            bestAmount = expectedAmountIn
            setAmountIn(expectedAmountIn)
            setBestRoute(route)
          } else {
            // Already have the best quote
            setAmountIn(bestAmount)
          }
        })
      } catch (err) {
        console.error('Error', err)
      }
    })()
  }, [dontRender, amountOut?.toSignificant(), currencyIn])

  return useMemo(() => {
    // console.log(
    //   `TradeOut ${bestRoute?.toString()} inputAmount ${amountIn?.toSignificant()} outputAmount ${amountOut?.toSignificant()}`
    // )
    if (!amountOut || !currencyIn || !routes[0]) {
      // Throw Illiquid error message for negative trades too
      // if (amountIn?.lessThan(new Fraction(0, 1))) {
      //   console.log('Getting -ve price for this trade')
      // }
      return {
        state: V3TradeState.INVALID,
        trade: null,
      }
    }

    if (routesLoading || !amountIn) {
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
        outputAmount: amountOut,
      },
    }
  }, [amountOut, currencyIn, amountIn, dontRender, routesLoading])
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
