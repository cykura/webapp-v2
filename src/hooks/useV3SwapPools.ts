import { Currency, Token } from '@cykura/sdk-core'
import { FeeAmount, Pool } from '@cykura/sdk'
import { useMemo } from 'react'
import { useAllCurrencyCombinations } from './useAllCurrencyCombinations'
import { usePools } from './usePools'

/**
 * Returns all the existing pools that should be considered for swapping between an input currency and an output currency
 * @param currencyIn the input currency
 * @param currencyOut the output currency
 */
export function useV3SwapPools(
  currencyIn?: Currency,
  currencyOut?: Currency
): {
  pools: Pool[]
  loading: boolean
} {
  const allCurrencyCombinations = useAllCurrencyCombinations(currencyIn, currencyOut)

  const feeCombos = useMemo(
    () =>
      allCurrencyCombinations.reduce(
        (prev, tokenPair) => {
          for (const fee of [
            FeeAmount.SUPER_STABLE,
            FeeAmount.TURBO_SPL,
            FeeAmount.LOW,
            FeeAmount.MEDIUM,
            FeeAmount.HIGH,
          ]) {
            prev.push({ tokenA: tokenPair[0], tokenB: tokenPair[1], fee })
          }
          return prev
        },
        [] as {
          tokenA: Token
          tokenB: Token
          fee: FeeAmount
        }[]
      ),
    [allCurrencyCombinations]
  )

  const pools = usePools(feeCombos)

  return useMemo(() => {
    if (!pools) {
      return {
        pools: [],
        loading: true,
      }
    }
    return {
      // Remove un-initialized pools
      pools: pools!.filter((pool) => {
        return pool !== undefined
      }) as Pool[],
      loading: false,
    }
  }, [pools, currencyIn, currencyOut])
}
