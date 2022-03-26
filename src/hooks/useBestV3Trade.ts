import { AccountMeta } from '@solana/web3.js'
import { Route, Trade } from '@cykura/sdk'
import { Currency, CurrencyAmount, Token, TradeType } from '@cykura/sdk-core'
import { useEffect, useState } from 'react'

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
    route: Route<Currency, Currency> | null
    amountOut: CurrencyAmount<Currency> | null
    accounts: AccountMeta[] | undefined
  }>()

  useEffect(() => {
    async function fetchPossibleSwaps() {
      setBestSwap(undefined)

      if (!amountIn || !currencyOut || !routes.length) return

      // No multihops for now, so only one pool per route
      const pools = routes.map((route) => route.pools[0])

      const results = Promise.all(
        pools.map(async (pool) => {
          try {
            return await pool.getOutputAmount(amountIn as CurrencyAmount<Token>)
          } catch (e) {
            console.log('failed to get quote with pool', pool.fee)
            return null
          }
        })
      )

      const swapOutputs = await results

      const res = swapOutputs.reduce(
        (
          currentBest: {
            route: Route<Currency, Currency> | null
            amountOut: CurrencyAmount<typeof currencyOut> | null
            accounts: AccountMeta[] | undefined
          },
          swapOutput,
          i
        ) => {
          if (!swapOutput) return currentBest

          if (currentBest.amountOut === null) {
            return {
              route: routes[i],
              amountOut: swapOutput[0],
              accounts: swapOutput[2],
            }
          } else if (currentBest.amountOut.lessThan(swapOutput[0])) {
            return {
              route: routes[i],
              amountOut: swapOutput[0],
              accounts: swapOutput[2],
            }
          }

          return currentBest
        },
        {
          route: null,
          amountOut: null,
          accounts: undefined,
        }
      )
      // console.log('BEST', res, res.amountOut?.toSignificant())
      setBestSwap(res)
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

  if (!bestSwap) {
    return {
      state: V3TradeState.INVALID,
      trade: undefined,
      accounts: undefined,
    }
  }

  if (!bestSwap?.amountOut?.currency) {
    return {
      state: V3TradeState.NO_ROUTE_FOUND,
      trade: undefined,
      accounts: undefined,
    }
  }

  if (
    !bestSwap ||
    !bestSwap?.route?.output.equals(bestSwap?.amountOut?.currency) ||
    !bestSwap?.route?.input.equals(amountIn.currency)
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
