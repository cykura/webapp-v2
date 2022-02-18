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
  const [poolAddr, setAddr] = useState<PublicKey[]>([])

  useEffect(() => {
    async function fetchPool() {
      if (currencyIn && currencyOut) {
        let [tk0, tk1] = [currencyIn?.wrapped, currencyOut?.wrapped]
        if (currencyIn?.wrapped.address !== currencyOut?.wrapped.address) {
          ;[tk0, tk1] = currencyIn?.wrapped.sortsBefore(currencyOut?.wrapped)
            ? [currencyIn?.wrapped, currencyOut?.wrapped]
            : [currencyOut?.wrapped, currencyIn?.wrapped] // does safety checks
        }

        const token0 = new PublicKey((tk0 as Token).address)
        const token1 = new PublicKey((tk1 as Token).address)
        ;[500, 3000, 10_000].forEach(async (fee) => {
          const generatedAddr = (
            await PublicKey.findProgramAddress(
              [POOL_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee)],
              PROGRAM_ID
            )
          )[0]
          // console.log('generated address', generatedAddr.toString(), ' for fee', fee)
          try {
            const poolInfo = await connection.getAccountInfo(generatedAddr)
            if (poolInfo) {
              setAddr((prevState) => [...prevState, generatedAddr])
            }
          } catch (error) {
            console.log('failed to get pool info', error)
          }
        })
      }
    }

    fetchPool()
  }, [currencyIn, currencyOut])

  return {
    pools: poolAddr,
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
