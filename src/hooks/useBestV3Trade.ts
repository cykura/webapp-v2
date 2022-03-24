import { AccountMeta } from '@solana/web3.js'
import { Route, Trade } from '@cykura/sdk'
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

      let best!: {
        route: Route<Currency, Currency>
        amountOut: CurrencyAmount<Currency>
        accounts: AccountMeta[]
      }

      for (const route of routes) {
        // currently every route has a single pool
        for (const poolIndex in route.pools) {
          const pool = route.pools[poolIndex]

          try {
            const swapOutput = await pool.getOutputAmount(amountIn as CurrencyAmount<Token>)
            if (!best || swapOutput[0] > best.amountOut) {
              best = { route, amountOut: swapOutput[0], accounts: swapOutput[2] }
            }
          } catch (error) {
            console.log('skip pool', error)
          }
        }
      }

      setBestSwap(best)
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
