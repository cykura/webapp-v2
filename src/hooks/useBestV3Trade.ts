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
import { Pool, Route, Trade } from '@uniswap/v3-sdk'
import usePrevious from './usePrevious'
import { SOL_LOCAL, WSOL_LOCAL } from 'constants/tokens'
import { NATIVE_MINT } from '@solana/spl-token'
import { useAllTokens, useToken } from './Tokens'

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

// /**
//  * Returns the best v3 trade for a desired exact input swap
//  * @param amountIn the amount to swap in
//  * @param currencyOut the desired output currency
//  */
export function useBestV3TradeExactIn(
  amountIn?: CurrencyAmount<Currency>,
  currencyOut?: Currency
  // ): { state: V3TradeState; trade: Trade<Currency, Currency, TradeType.EXACT_INPUT> | null } {
): {
  state: V3TradeState
  trade: Trade<Currency, Currency, TradeType.EXACT_INPUT> | null
  accounts: PublicKey[] | undefined
} {
  const { routes, loading: routesLoading } = useAllV3Routes(amountIn?.currency, currencyOut)

  // console.log(routesLoading, routes, poolIds)

  const [amounts, setAmounts] = useState<any>([])

  // console.log(routes)
  // console.log(
  //   routes.map((r) => r.pools.map((p, i) => `${i + 1} ${p.token0.symbol} ${p.token1.symbol} ${p.fee.toString()}`))
  // )
  // console.log(routes.map((r, i) => `${i + 1} ${r.tokenPath.map((p) => `${p.name}->`)}`))
  // console.log(poolIds.flat().map((r, i) => r.toString()))

  useEffect(() => {
    async function fetchPoolState() {
      if (!amountIn) return
      // console.log(routes, poolIds)

      const result: any = Promise.all(
        routes.map((route, i) => {
          // console.log(i + 1, ' ROUTE')
          const { input, output, pools, tokenPath } = route as any
          const pairTokenPath = tokenPath
            .slice()
            .map((_: any, i: any, a: any) => a.slice(0 + i, i + 2))
            .filter((ar: any) => ar.length == 2)
            .map((a: any) => `${a[0].symbol} ${a[1].symbol}`)
          // console.log(`Pairs will be ${pairTokenPath}`)

          // Wrt to the pools, gives where there tokens in the tokenPath is sorted or not.
          const order = pools.map((pool: any, index: any) => {
            // return pairTokenPath[index].split(' ')[0]
            if (
              pool.token0.symbol == pairTokenPath[index].split(' ')[0] &&
              pool.token1.symbol === pairTokenPath[index].split(' ')[1]
            ) {
              return true
            }
            return false
          })
          // console.log('Order wrt Pools', order)
          const res = Promise.all(
            order.map(async (o: any, i: any) => {
              const pool = pools[i] as any
              if (o) {
                // sorted order of pool present
                // console.log(pool.token0.symbol, pool.token1.symbol)
                return await pool.getOutputAmount(amountIn)
              } else {
                // console.log(pool.token0.symbol, pool.token1.symbol)
                try {
                  // Need to check what amounts are actually passed here. Might be some precision problem
                  // const amtIn = CurrencyAmount.fromRawAmount(pool.token1, parseInt(amountIn.toFixed()).toString())
                  // return await pool.getInputAmount(amtIn)

                  // This works for single pair
                  return await pool.getInputAmount(amountIn)
                } catch (e) {
                  console.log(pool, o)
                  console.log('This fails?', e)
                }
              }
            })
          )
          // console.log(result)
          return res
        })
      )

      const d = await result
      // console.log(d)
      setAmounts(d)
    }
    // console.log('fetchPoolState called')
    fetchPoolState().then()
  }, [routes, routesLoading])

  if (amounts) {
    console.log(
      'IN',
      amounts.flat().map((a: any) => `${a[0].toFixed(2)} ${a[1].token0.symbol} ${a[1].token1.symbol}`)
    )
  }

  return useMemo(() => {
    if (!amountIn || !currencyOut) {
      return {
        state: V3TradeState.INVALID,
        trade: null,
        accounts: undefined,
      }
    }

    if (routesLoading) {
      return {
        state: V3TradeState.LOADING,
        trade: null,
        accounts: undefined,
      }
    }

    const { bestRoute, amountOut } = amounts.flat().reduce(
      (
        currentBest: {
          bestRoute: Route<Currency, Currency> | null
          amountOut: number | null
        },
        amount: any,
        i: any
      ) => {
        if (!amount) return currentBest

        if (currentBest.amountOut === null) {
          return {
            bestRoute: routes[i],
            amountOut: amount[0].toFixed(2),
          }
        } else if (currentBest.amountOut < amount[0].toFixed(2)) {
          return {
            bestRoute: routes[i],
            amountOut: amount[0].toFixed(2),
          }
        }

        return currentBest
      },
      {
        bestRoute: null,
        amountOut: null,
      }
    )

    if (!bestRoute || !amountOut) {
      return {
        state: V3TradeState.NO_ROUTE_FOUND,
        trade: null,
        accounts: undefined,
      }
    }

    // const isSyncing = quotesResults.some(({ syncing }) => syncing)

    console.log(bestRoute, amountOut, 'IN')
    const finalAmount = JSBI.BigInt((amountOut * 10 ** currencyOut.decimals).toString())
    return {
      // state: isSyncing ? V3TradeState.SYNCING : V3TradeState.VALID,
      state: V3TradeState.VALID,
      trade: Trade.createUncheckedTrade({
        route: bestRoute,
        tradeType: TradeType.EXACT_INPUT,
        inputAmount: amountIn,
        outputAmount: CurrencyAmount.fromRawAmount(currencyOut, finalAmount),
      }),
      accounts: [PublicKey.default], // Figure out how to pass the actual accounts here
    }
  }, [amountIn, currencyOut, amounts, routes, routesLoading])
}

// /**
//  * Returns the best v3 trade for a desired exact output swap
//  * @param currencyIn the desired input currency
//  * @param amountOut the amount to swap out
//  */

export function useBestV3TradeExactOut(
  currencyIn?: Currency,
  amountOut?: CurrencyAmount<Currency>
): {
  state: V3TradeState
  trade: Trade<Currency, Currency, TradeType.EXACT_OUTPUT> | null
  accounts: PublicKey[] | undefined
} {
  const { routes, loading: routesLoading } = useAllV3Routes(currencyIn, amountOut?.currency)
  // console.log(routesLoading, routes)
  const [amounts, setAmounts] = useState<any>([])

  useMemo(() => {
    async function fetchPoolState() {
      if (!amountOut) return

      const result: any = Promise.all(
        routes.map((route, i) => {
          // console.log(route)
          const { input, output, pools, tokenPath } = route as any

          const pairTokenPath = tokenPath
            .slice()
            .map((_: any, i: any, a: any) => a.slice(0 + i, i + 2))
            .filter((ar: any) => ar.length == 2)
            .map((a: any) => `${a[0].symbol} ${a[1].symbol}`)

          // console.log(`Pairs will be ${pairTokenPath}`)
          // Wrt to the pools, gives where there tokens in the tokenPath is sorted or not.
          const order = pools.map((pool: any, index: any) => {
            if (
              pool.token0.symbol == pairTokenPath[index].split(' ')[0] &&
              pool.token1.symbol === pairTokenPath[index].split(' ')[1]
            ) {
              return true
            }
            return false
          })
          // console.log(order)

          const res = Promise.all(
            order.map(async (o: any, i: any) => {
              const pool = pools[i] as any
              // console.log(o, ' is the TRUTH')
              if (o) {
                // sorted order of pool present
                // const amtOut = CurrencyAmount.fromRawAmount(pool.token0, +amountOut.toFixed(2) * -1)
                // return await pool.getOutputAmount(amtOut)
                return await pool.getOutputAmount(amountOut)
              } else {
                // console.log(pool.token0.symbol, pool.token1.symbol)
                try {
                  // This works for single pair
                  // const amtOut = CurrencyAmount.fromRawAmount(pool.token0, +amountOut.toFixed(2) * -1)
                  // return await pool.getOutputAmount(amtOut)
                  return await pool.getOutputAmount(amountOut)
                } catch (e) {
                  console.log(pool, o)
                  console.log('This fails?', e)
                }
              }
            })
          )
          // console.log(result)
          return res
        })
      )
      const d = await result
      // console.log(d)
      setAmounts(d)
    }

    fetchPoolState()
  }, [routes, routesLoading])

  if (amounts) {
    console.log(
      'OUT',
      amounts.flat().map((a: any) => `${a[0].toFixed(2)} ${a[1].token0.symbol} ${a[1].token1.symbol}`)
    )
  }

  return useMemo(() => {
    if (!amountOut || !currencyIn) {
      return {
        state: V3TradeState.INVALID,
        trade: null,
        accounts: undefined,
      }
    }

    if (routesLoading) {
      return {
        state: V3TradeState.LOADING,
        trade: null,
        accounts: undefined,
      }
    }

    const { bestRoute, amountIn } = amounts.flat().reduce(
      (currentBest: { bestRoute: Route<Currency, Currency> | null; amountIn: number | null }, amount: any, i: any) => {
        if (!amount) return currentBest

        if (currentBest.amountIn === null) {
          return {
            bestRoute: routes[i],
            amountIn: amount[0].toFixed(2),
          }
        } else if (currentBest.amountIn < amount[0].toFixed(2)) {
          return {
            bestRoute: routes[i],
            amountIn: amount[0].toFixed(2),
          }
        }

        return currentBest
      },
      {
        bestRoute: null,
        amountIn: null,
      }
    )

    if (!bestRoute || !amountIn) {
      return {
        state: V3TradeState.NO_ROUTE_FOUND,
        trade: null,
        accounts: undefined,
      }
    }

    const finalAmount = JSBI.BigInt((amountIn * 10 ** currencyIn.decimals).toString())

    console.log(bestRoute, 'OUT')
    return {
      state: V3TradeState.VALID,
      trade: Trade.createUncheckedTrade({
        route: bestRoute,
        tradeType: TradeType.EXACT_OUTPUT,
        inputAmount: CurrencyAmount.fromRawAmount(currencyIn, finalAmount),
        outputAmount: amountOut,
      }),
      accounts: [PublicKey.default], // Figure out how to pass the actual accounts here
    }
  }, [amountOut, currencyIn, amounts, routes, routesLoading])
}
