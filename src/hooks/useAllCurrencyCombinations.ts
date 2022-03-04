import { Currency, Token } from '@cykura/sdk-core'
import flatMap from 'lodash.flatmap'
import { useMemo } from 'react'
import { BASES_TO_CHECK_TRADES_AGAINST } from '../constants/routing'
import { useActiveWeb3ReactSol } from './web3'

export function useAllCurrencyCombinations(currencyA?: Currency, currencyB?: Currency): [Token, Token][] {
  const { chainId } = useActiveWeb3ReactSol()

  const [tokenA, tokenB] = chainId ? [currencyA?.wrapped, currencyB?.wrapped] : [undefined, undefined]

  const bases: Token[] = useMemo(() => {
    if (!chainId) return []

    const common = BASES_TO_CHECK_TRADES_AGAINST[chainId] ?? []

    return [...common]
  }, [chainId, tokenA, tokenB])

  const basePairs: [Token, Token][] = useMemo(
    () => flatMap(bases, (base): [Token, Token][] => bases.map((otherBase) => [base, otherBase])),
    [bases]
  )

  return useMemo(() => {
    return tokenA && tokenB
      ? [
          // the direct pair
          [tokenA, tokenB],
          // token A against all bases
          ...bases.map((base): [Token, Token] => [tokenA, base]),
          // token B against all bases
          ...bases.map((base): [Token, Token] => [tokenB, base]),
          // each base against all bases
          ...basePairs,
        ]
          .filter((tokens): tokens is [Token, Token] => Boolean(tokens[0] && tokens[1]))
          .filter(([t0, t1]) => t0.address !== t1.address)
      : []
  }, [tokenA, tokenB, bases, basePairs, chainId])
}
