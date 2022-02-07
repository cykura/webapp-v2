import { Currency } from '@uniswap/sdk-core'
import { Pool, Route } from '@uniswap/v3-sdk'
import { useMemo, useState } from 'react'
import { useUserSingleHopOnly } from '../state/user/hooks'
import { useActiveWeb3ReactSol } from './web3'
import { useV3SwapPools } from './useV3SwapPools'
import { PublicKey } from '@solana/web3.js'

function computeAllRoutes(
  currencyIn: Currency,
  currencyOut: Currency,
  pools: Pool[],
  chainId: number,
  currentPath: Pool[] = [],
  allPaths: Route<Currency, Currency>[] = [],
  startCurrencyIn: Currency = currencyIn,
  maxHops = 2
): Route<Currency, Currency>[] {
  const tokenIn = currencyIn?.wrapped
  const tokenOut = currencyOut?.wrapped
  if (!tokenIn || !tokenOut) throw new Error('Missing tokenIn/tokenOut')

  for (const pool of pools) {
    if (currentPath.indexOf(pool) !== -1 || !pool.involvesToken(tokenIn)) continue

    const outputToken = pool.token0.equals(tokenIn) ? pool.token1 : pool.token0
    if (outputToken.equals(tokenOut)) {
      allPaths.push(new Route([...currentPath, pool], startCurrencyIn, currencyOut))
    } else if (maxHops > 1) {
      computeAllRoutes(
        outputToken,
        currencyOut,
        pools,
        chainId,
        [...currentPath, pool],
        allPaths,
        startCurrencyIn,
        maxHops - 1
      )
    }
  }

  return allPaths
}

/**
 * Returns all the routes from an input currency to an output currency
 * @param currencyIn the input currency
 * @param currencyOut the output currency
 */
export function useAllV3Routes(
  currencyIn?: Currency,
  currencyOut?: Currency
): { loading: boolean; routes: PublicKey[] } {
  const { chainId } = useActiveWeb3ReactSol()

  // return Cyclos liquidity pool addresses

  const [singleHopOnly] = useUserSingleHopOnly()

  const { pools, loading: poolsLoading } = useV3SwapPools(currencyIn, currencyOut)

  // const [p, setP] = useState<PublicKey[]>([])
  // setP(pools)

  // console.log('fetched pools', pools)

  return useMemo(() => {
    if (poolsLoading || !chainId || !pools || !currencyIn || !currencyOut) return { loading: true, routes: [] }
    // console.log('fetched pools', pools)
    return { loading: false, routes: pools }
    // const routes = computeAllRoutes(currencyIn, currencyOut, pools, chainId, [], [], currencyIn, singleHopOnly ? 1 : 2)
    // return { loading: false, routes }
  }, [chainId, currencyIn, currencyOut, [...pools], singleHopOnly])
}
