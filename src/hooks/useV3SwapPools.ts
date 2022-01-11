import { useSolana } from '@saberhq/use-solana'
import { PublicKey } from '@solana/web3.js'
import { Currency, Token } from '@uniswap/sdk-core'
import { FeeAmount, Pool, u32ToSeed } from '@uniswap/v3-sdk'
import { PROGRAM_ID } from 'constants/addresses'
import { POOL_SEED } from 'constants/tokens'
import { useEffect, useMemo, useState } from 'react'
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
  pools: PublicKey[]
  loading: boolean
} {
  const { connection } = useSolana()
  const [poolAddr, setAddr] = useState<PublicKey>()

  useEffect(() => {
    async function fetchPool() {
      if (currencyIn && currencyOut) {
        let token0 = new PublicKey((currencyIn as Token).address)
        let token1 = new PublicKey((currencyOut as Token).address)
        if (token0.toString() > token1.toString()) {
          const temp = token0
          token0 = token1
          token1 = temp
        }
        const generatedAddr = (
          await PublicKey.findProgramAddress(
            [POOL_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(500)],
            PROGRAM_ID
          )
        )[0]
        console.log('generated address', generatedAddr.toString())
        try {
          const poolInfo = await connection.getAccountInfo(generatedAddr)
          if (poolInfo) {
            setAddr(generatedAddr)
          }
        } catch (error) {
          console.log('failed to get pool info', error)
        }
      }
    }

    fetchPool()
  }, [currencyIn, currencyOut])

  return {
    pools: poolAddr ? [poolAddr] : [],
    loading: false,
  }

  // const allCurrencyCombinations = useAllCurrencyCombinations(currencyIn, currencyOut)

  // const allCurrencyCombinationsWithAllFees: [Token, Token, FeeAmount][] = useMemo(
  //   () =>
  //     allCurrencyCombinations.reduce<[Token, Token, FeeAmount][]>((list, [tokenA, tokenB]) => {
  //       return list.concat([
  //         [tokenA, tokenB, FeeAmount.LOW],
  //         [tokenA, tokenB, FeeAmount.MEDIUM],
  //         [tokenA, tokenB, FeeAmount.HIGH],
  //       ])
  //     }, []),
  //   [allCurrencyCombinations]
  // )
  // console.log('all combinations', allCurrencyCombinations)
  // const combination = [[currencyIn, currencyOut, FeeAmount.LOW]]

  // let token0 = currencyIn
  // // const [tk1, tk2] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]

  // // const token1 = new anchor.web3.PublicKey(tk1.address)
  // // const token2 = new anchor.web3.PublicKey(tk2.address)
  // const pools = usePools(allCurrencyCombinationsWithAllFees)
  // console.log('got pools', pools)

  // return useMemo(() => {
  //   return {
  //     pools: pools
  //       .filter((tuple): tuple is [PoolState.EXISTS, Pool] => {
  //         return tuple[0] === PoolState.EXISTS && tuple[1] !== null
  //       })
  //       .map(([, pool]) => pool),
  //     loading: pools.some(([state]) => state === PoolState.LOADING),
  //   }
  // }, [pools])
}
