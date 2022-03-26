import { AccountMeta } from '@solana/web3.js'
import { Pool, Route, Trade } from '@cykura/sdk'
import { Currency, CurrencyAmount, Token, TradeType } from '@cykura/sdk-core'
import { useEffect, useState } from 'react'
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
 * @param route the possible token routes
 * @param amountIn the amount to swap in
 * @param currencyOut the desired output currency
 */
export function useBestV3TradeExactIn(
  routes: Route<Currency, Currency>[],
  amountIn?: CurrencyAmount<Currency>,
  currencyOut?: Currency
): {
  state: V3TradeState
  trade: Trade<Currency, Currency, TradeType.EXACT_INPUT> | undefined
  accounts: AccountMeta[] | undefined
} {
  const [bestSwap, setBestSwap] = useState<{
    route: Route<Currency, Currency>
    amountOut: CurrencyAmount<Currency>
    accounts: AccountMeta[]
  }>()

  useEffect(() => {
    async function fetchPossibleSwaps() {
      setBestSwap(undefined)

      if (!amountIn || !currencyOut || !routes.length) return

      const best: {
        route: Route<Currency, Currency>
        amountOut: CurrencyAmount<Currency>
        accounts: AccountMeta[]
      } = {
        route: routes[0],
        amountOut: CurrencyAmount.fromRawAmount(currencyOut, 0),
        accounts: [],
      }

      // currently every route has a single pool
      // TODO: This will be array in itself for multi hop pools
      const pools = routes.map((r) => r.pools[0])

      const data = Promise.all(
        pools.map(async (p) => {
          return await p.getOutputAmount(amountIn as CurrencyAmount<Token>)
        })
      )

      const res = await data

      let bestAmountOut = CurrencyAmount.fromRawAmount(currencyOut, 0)
      let bestRoute: any
      let accs: any

      res.forEach((arr, i) => {
        if (bestAmountOut.equalTo(0)) {
          bestAmountOut = arr[0]
          bestRoute = routes[i]
          accs = arr[2]
        } else {
          if (arr[0].greaterThan(bestAmountOut)) {
            bestAmountOut = arr[0]
            bestRoute = routes[i]
            accs = arr[2]
          }
        }
      })
      ;(best.route = bestRoute), (best.amountOut = bestAmountOut), (best.accounts = accs), setBestSwap(best)
    }

    fetchPossibleSwaps()
  }, [routes, amountIn?.toExact()])

  if (!amountIn || !currencyOut) {
    return {
      state: V3TradeState.INVALID,
      trade: undefined,
      accounts: undefined,
    }
  }

  if (routes.length && !bestSwap) {
    return {
      state: V3TradeState.LOADING,
      trade: undefined,
      accounts: undefined,
    }
  }

  if (
    !bestSwap ||
    !bestSwap.route.output.equals(bestSwap.amountOut.currency) ||
    !bestSwap.route.input.equals(amountIn.currency)
  ) {
    return {
      state: V3TradeState.NO_ROUTE_FOUND,
      trade: undefined,
      accounts: undefined,
    }
  }

  return {
    state: V3TradeState.VALID,
    trade: Trade.createUncheckedTrade({
      route: bestSwap.route,
      tradeType: TradeType.EXACT_INPUT,
      inputAmount: amountIn,
      outputAmount: bestSwap.amountOut,
    }),
    accounts: bestSwap.accounts,
  }
}
