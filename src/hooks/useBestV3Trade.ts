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

/**
 * Returns the best v3 trade for a desired exact input swap
 * @param amountIn the amount to swap in
 * @param currencyOut the desired output currency
 */
export function useBestV3TradeExactIn(
  amountIn?: CurrencyAmount<Currency>,
  currencyOut?: Currency
): {
  state: V3TradeState
  trade: Trade<Currency, Currency, TradeType.EXACT_INPUT> | undefined
  accounts: AccountMeta[] | undefined
} {
  const { routes, loading: routesLoading } = useAllV3Routes(amountIn?.currency, currencyOut)
  const [swaps, setSwaps] = useState<[CurrencyAmount<Token>, Pool, AccountMeta[]][][]>()

  useEffect(() => {
    async function fetchPossibleSwaps() {
      if (!amountIn || !currencyOut || !routes.length) return

      // fetch the possible swaps for each pool in a route
      const allPossibleSwaps: [CurrencyAmount<Token>, Pool, AccountMeta[]][][] = []
      for (const route of routes) {
        const swapsPerRoute: [CurrencyAmount<Token>, Pool, AccountMeta[]][] = []
        for (const poolIndex in route.pools) {
          const pool = route.pools[poolIndex]

          try {
            swapsPerRoute.push(await pool.getOutputAmount(amountIn as CurrencyAmount<Token>))
          } catch (error) {
            console.log('skip pool', error)
          }
        }
        allPossibleSwaps.push(swapsPerRoute)
      }
      setSwaps(allPossibleSwaps)
    }

    fetchPossibleSwaps()
  }, [routes, routesLoading, amountIn?.toExact()])

  return useMemo(() => {
    if (!amountIn || !currencyOut) {
      return {
        state: V3TradeState.INVALID,
        trade: undefined,
        accounts: undefined,
      }
    }

    if (routes.length && !swaps) {
      return {
        state: V3TradeState.LOADING,
        trade: undefined,
        accounts: undefined,
      }
    }

    const possibleSwaps =
      swaps?.flat().map((swap) => {
        const amt: CurrencyAmount<Currency> = swap[0]

        let absAmt = amt
        // If negative. take abs
        if (amt.lessThan(0)) {
          const { numerator, denominator } = amt.multiply('-1')
          absAmt = CurrencyAmount.fromFractionalAmount(currencyOut, numerator, denominator)
        }

        return [absAmt, swap[1], swap[2]]
      }) ?? []

    // Return the best route
    const { bestRoute, amountOut, swapAccounts } = possibleSwaps.reduce(
      (
        currentBest: {
          bestRoute: Route<Currency, Currency> | null
          amountOut: CurrencyAmount<typeof currencyOut> | null
          swapAccounts: AccountMeta[] | undefined
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
        swapAccounts: undefined,
      }
    )

    if (!bestRoute || !amountOut || !bestRoute.output.equals(amountOut.currency)) {
      return {
        state: V3TradeState.LOADING,
        trade: undefined,
        accounts: undefined,
      }
    }

    return {
      state: V3TradeState.VALID,
      trade: Trade.createUncheckedTrade({
        route: bestRoute,
        tradeType: TradeType.EXACT_INPUT,
        inputAmount: amountIn,
        outputAmount: amountOut,
      }),
      accounts: swapAccounts,
    }
  }, [amountIn, currencyOut, swaps, routes, routesLoading])
}
