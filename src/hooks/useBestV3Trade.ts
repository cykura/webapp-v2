import { AccountMeta } from '@solana/web3.js'
import { Pool, Route, Trade } from '@cykura/sdk'
import { Currency, CurrencyAmount, Token, TradeType } from '@cykura/sdk-core'
import { useEffect, useMemo, useState } from 'react'
import { useAllV3Routes } from './useAllV3Routes'

export enum V3TradeState {
  LOADING,
  INVALID,
  NO_ROUTE_FOUND,
  VALID,
  SYNCING,
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
  accounts: AccountMeta[] | undefined
} {
  const { routes, loading: routesLoading } = useAllV3Routes(amountIn?.currency, currencyOut)
  // console.log(routes)
  // console.log(amountIn?.currency.symbol, currencyOut?.symbol)
  // console.log(routesLoading, routes)

  const [amounts, setAmounts] = useState<any>([])

  // console.log(
  //   routes.map((r) => r.pools.map((p, i) => `${i + 1} ${p.token0.symbol} ${p.token1.symbol} ${p.fee.toString()}`))
  // )
  // console.log(routes.map((r, i) => `${i + 1} ${r.tokenPath.map((p) => `${p.name}->`)}`))
  // console.log(poolIds.flat().map((r, i) => r.toString()))

  useEffect(() => {
    // console.log(routes)
    async function fetchPoolState() {
      const result: any = Promise.all(
        routes.map((route, i) => {
          // console.log(i + 1, ' ROUTE')
          const { input, output, pools, tokenPath } = route
          const pairTokenPath = tokenPath
            .slice()
            .map((_: any, i: any, a: any) => a.slice(0 + i, i + 2))
            .filter((ar: any) => ar.length == 2)
            .map((a: any) => `${a[0].symbol} ${a[1].symbol}`)
          // console.log(`Pairs will be ${pairTokenPath}`)

          // Wrt to the pools, gives where there tokens in the tokenPath is sorted or not.
          const orders = pools.map((pool, index) => {
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
            orders.map(async (poolOrder, index) => {
              const pool = pools[index]
              if (!amountIn || !currencyOut) return

              const amtIn = CurrencyAmount.fromRawAmount(
                amountIn.currency,
                amountIn.numerator.toString()
              ) as CurrencyAmount<Token>
              if (poolOrder) {
                // sorted order of pool present
                // CYS -> USDC. Input CYS
                // console.log('IF in')
                // console.log(amountIn?.currency.symbol, currencyOut?.symbol)
                return await pool.getOutputAmount(amtIn)
              } else {
                // console.log(pool.token0.symbol, pool.token1.symbol)
                try {
                  // USDC -> CYS. Input USDC. This doesn't work now. Returns negative amount
                  // const { numerator, denominator } = amountIn.multiply('1')
                  // const amtIn = CurrencyAmount.fromFractionalAmount(currencyOut, numerator, denominator)
                  // console.log('ELSE in')
                  // console.log(amountIn?.currency.symbol, currencyOut?.symbol)
                  // const a = CurrencyAmount.fromRawAmount(amountIn.currency, amtIn.numerator.toString())
                  // console.log(a.toFixed())
                  return await pool.getOutputAmount(amtIn)
                } catch (e) {
                  console.log(pool, poolOrder)
                  console.log('This fails?', e)
                  return undefined
                }
              }
            })
          )
          // console.log(result)
          return res
        })
      )

      const fetchedAmounts = await result
      setAmounts(fetchedAmounts)
    }
    fetchPoolState()
  }, [routes, routesLoading, amountIn?.toExact()])

  return useMemo(() => {
    if (!amountIn || !currencyOut) {
      return {
        state: V3TradeState.INVALID,
        trade: null,
        accounts: undefined,
      }
    }

    if (routesLoading) {
      // console.log('LOADING TRADE')
      return {
        state: V3TradeState.LOADING,
        trade: null,
        accounts: undefined,
      }
    }

    const absAmouts = amounts.flat().map((amount: any) => {
      const amt: CurrencyAmount<Currency> = amount[0]
      // const ZERO = CurrencyAmount.fromRawAmount(amountIn.currency, 0)

      // console.log(amount[0])
      // console.log(amount[0], amount[1], amount[2])

      let absAmt = amt
      // If negative. take abs
      if (+amt.toFixed(2) < 0) {
        const { numerator, denominator } = amt.multiply('-1')
        absAmt = CurrencyAmount.fromFractionalAmount(currencyOut, numerator, denominator)
      }

      return [absAmt, amount[1], amount[2]]
    })

    // if (amounts) {
    //   const flatAmounts = amounts.flat()
    //   console.log(
    //     'IN',
    //     flatAmounts.map((a: any) => `${a[0].toFixed(2)} ${a[1].token0.symbol} ${a[1].token1.symbol} ${a[1].fee}}`)
    //   )
    //   console.log(flatAmounts.map((a: any) => a[2].flat().map((i: any) => i)))
    // }

    // if (amounts) {
    //   console.log(
    //     'IN',
    //     absAmouts.map((a: any) => `${a[0].toFixed(2)} ${a[1].token0.symbol} ${a[1].token1.symbol} ${a[1].fee} `)
    //   )
    // }

    const { bestRoute, amountOut, swapAccounts } = absAmouts.reduce(
      (
        currentBest: {
          bestRoute: Route<Currency, Currency> | null
          amountOut: CurrencyAmount<typeof currencyOut> | null
          swapAccounts: AccountMeta[] | null
        },
        amount: any,
        i: any
      ) => {
        if (!amount) return currentBest

        if (currentBest.amountOut === null) {
          return {
            bestRoute: routes[i],
            amountOut: amount[0],
            swapAccounts: amount[2],
          }
        } else if (currentBest.amountOut.lessThan(amount[0])) {
          return {
            bestRoute: routes[i],
            amountOut: amount[0],
            swapAccounts: amount[2],
          }
        }

        return currentBest
      },
      {
        bestRoute: null,
        amountOut: null,
        swapAccounts: null,
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

    // console.log(
    //   bestRoute,
    //   swapAccounts.map((a: any) => a.toString()),
    //   'IN'
    // )
    return {
      // state: isSyncing ? V3TradeState.SYNCING : V3TradeState.VALID,
      state: V3TradeState.VALID,
      trade: Trade.createUncheckedTrade({
        route: bestRoute,
        tradeType: TradeType.EXACT_INPUT,
        inputAmount: amountIn,
        outputAmount: amountOut,
      }),
      accounts: swapAccounts, // Figure out how to pass the actual accounts here
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
  accounts: AccountMeta[] | undefined
} {
  const { routes, loading: routesLoading } = useAllV3Routes(currencyIn, amountOut?.currency)
  const [amounts, setAmounts] = useState<([CurrencyAmount<Token>, Pool, AccountMeta[]] | undefined)[][]>([])

  useEffect(() => {
    async function fetchPoolState() {
      const result = Promise.all(
        routes.map((route) => {
          const { pools, tokenPath } = route

          const pairTokenPath = tokenPath
            .slice()
            .map((_, i, a) => a.slice(0 + i, i + 2))
            .filter((ar) => ar.length == 2)
            .map((a) => `${a[0].symbol} ${a[1].symbol}`)

          // console.log(`Pairs will be ${pairTokenPath}`)
          // Wrt to the pools, gives where there tokens in the tokenPath is sorted or not.
          const orderMap = pools.map((pool, index) => {
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
            orderMap.map(async (o, i) => {
              const pool = pools[i]
              // console.log(o, ' is the TRUTH')
              if (!amountOut || !currencyIn) return
              const amtOut = CurrencyAmount.fromRawAmount(
                amountOut.currency,
                amountOut.numerator.toString()
              ) as CurrencyAmount<Token>

              return await pool.getOutputAmount(amtOut)

              // if (o) {
              //   return await pool.getOutputAmount(amtOut)
              // } else {
              //   // console.log(pool.token0.symbol, pool.token1.symbol)
              //   try {
              //     return await pool.getOutputAmount(amtOut)
              //   } catch (e) {
              //     console.log(pool, o)
              //     console.log('This fails?', e)
              //     return undefined
              //   }
              // }
            })
          )
          // console.log(result)
          return res
        })
      )
      const d = await result
      setAmounts(d)
    }

    fetchPoolState()
  }, [routes, routesLoading, amountOut?.toExact()])

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

    // amountIn, pool, pool-pubkey
    const absAmounts = amounts
      .flat()
      .filter((amt) => amt !== undefined)
      .map((amount) => {
        const amt: CurrencyAmount<Currency> = amount![0]

        let absAmt = amt
        // If negative. take abs
        if (+amt.toFixed(2) < 0) {
          const { numerator, denominator } = amt.multiply('-1')
          absAmt = CurrencyAmount.fromFractionalAmount(currencyIn, numerator, denominator)
        }

        return [absAmt, amount![1], amount![2]]
      })

    let bestPath:
      | {
          bestRoute: Route<Currency, Currency>
          amountIn: CurrencyAmount<typeof currencyIn>
          swapAccounts: AccountMeta[]
        }
      | undefined = undefined

    for (const index in absAmounts) {
      const amount = absAmounts[index]
      // find the path which gives the smallest amountIn
      if (!bestPath || bestPath.amountIn.lessThan(amount[0] as CurrencyAmount<Currency>)) {
        bestPath = {
          bestRoute: routes[index],
          amountIn: amount[0] as CurrencyAmount<Currency>,
          swapAccounts: amount[2] as AccountMeta[],
        }
      }
    }

    if (!bestPath) {
      return {
        state: V3TradeState.NO_ROUTE_FOUND,
        trade: null,
        accounts: undefined,
      }
    }
    const { bestRoute, amountIn, swapAccounts } = bestPath

    return {
      state: V3TradeState.VALID,
      trade: Trade.createUncheckedTrade({
        route: bestRoute,
        tradeType: TradeType.EXACT_OUTPUT,
        inputAmount: amountIn,
        outputAmount: amountOut,
      }),
      accounts: swapAccounts, // Figure out how to pass the actual accounts here
    }
  }, [amountOut, currencyIn, amounts, routes, routesLoading])
}
