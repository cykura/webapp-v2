import { Currency, Token } from '@cykura/sdk-core'
import { FeeAmount, Pool } from '@cykura/sdk'
import { useMemo } from 'react'
import { useAllCurrencyCombinations } from './useAllCurrencyCombinations'
import { PoolState, usePools } from './usePools'

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

  // Fee tier adds a new degree of freedom
  const allCurrencyCombinationsWithAllFees: [Token, Token, FeeAmount][] = useMemo(
    () =>
      allCurrencyCombinations.reduce<[Token, Token, FeeAmount][]>((list, [tokenA, tokenB]) => {
        return list.concat([
          [tokenA, tokenB, FeeAmount.SUPER_STABLE],
          [tokenA, tokenB, FeeAmount.TURBO_SPL],
          [tokenA, tokenB, FeeAmount.LOW],
          [tokenA, tokenB, FeeAmount.MEDIUM],
          [tokenA, tokenB, FeeAmount.HIGH],
        ])
      }, []),
    [allCurrencyCombinations]
  )
  const pools = usePools(allCurrencyCombinationsWithAllFees)

  return useMemo(() => {
    // Remove un-initialized pools
    const filteredPools = pools
      .filter((tuple): tuple is [PoolState.EXISTS, Pool] => {
        return tuple[0] === PoolState.EXISTS && tuple[1] !== null
      })
      .map(([, pool]) => pool)
    return {
      pools: filteredPools,
      loading: pools.some(([state]) => state === PoolState.LOADING),
    }
  }, [pools, currencyIn, currencyOut])
}
