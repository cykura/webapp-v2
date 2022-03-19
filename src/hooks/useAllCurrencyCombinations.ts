import { Currency, Token } from '@cykura/sdk-core'
import { useMemo } from 'react'
import { useActiveWeb3ReactSol } from './web3'

/**
 * Get possible currency combinations to swap from one currency to another.
 *
 * Uniswap checks across base tokens, eg. SOL-SRM combinations can be
 * [SOL-SRM, SOL-USDC-SRM].
 *
 * Rump function- Multi-pool trade support is dropped in favor of Jupiter integration.
 *
 * @param currencyA
 * @param currencyB
 * @returns
 */
export function useAllCurrencyCombinations(currencyA?: Currency, currencyB?: Currency): [Token, Token][] {
  const { chainId } = useActiveWeb3ReactSol()

  const [tokenA, tokenB] = chainId ? [currencyA?.wrapped, currencyB?.wrapped] : [undefined, undefined]

  return useMemo(() => {
    return tokenA && tokenB ? [[tokenA, tokenB]] : []
  }, [tokenA, tokenB, chainId])
}
