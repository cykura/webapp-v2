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
  pools: Pool[]
  loading: boolean
  poolIds: PublicKey[]
} {
  const { connection } = useSolana()
  const [poolAddr, setAddr] = useState<PublicKey[]>([])

  const allCurrencyCombinations = useAllCurrencyCombinations(currencyIn, currencyOut)
  // console.log(allCurrencyCombinationsWithAllFees.map((tk) => `${tk[0].symbol} ${tk[1].symbol}`))

  const allCurrencyCombinationsWithAllFees: [Token, Token, FeeAmount][] = useMemo(
    () =>
      allCurrencyCombinations.reduce<[Token, Token, FeeAmount][]>((list, [tokenA, tokenB]) => {
        return list.concat([
          [tokenA, tokenB, FeeAmount.LOW],
          [tokenA, tokenB, FeeAmount.MEDIUM],
          [tokenA, tokenB, FeeAmount.HIGH],
        ])
      }, []),
    [allCurrencyCombinations]
  )

  // console.log(allCurrencyCombinationsWithAllFees.map((tk) => `${tk[0].symbol} ${tk[1].symbol} ${tk[2].valueOf()}`))

  // Fetch all pools for the calculated pairs above
  const pools = usePools(allCurrencyCombinationsWithAllFees)
  // console.log(pools)

  return useMemo(() => {
    const r = {
      pools: pools
        .filter((tuple): tuple is [PoolState.EXISTS, Pool, PublicKey] => {
          return tuple[0] === PoolState.EXISTS && tuple[1] !== null
        })
        .map(([, pool]) => pool),
      loading: pools.some(([state]) => state === PoolState.LOADING),
      poolIds: pools
        .filter((tuple): tuple is [PoolState.EXISTS, Pool, PublicKey] => {
          return tuple[0] === PoolState.EXISTS && tuple[1] !== null
        })
        .map(([, , pb]) => pb),
    }
    // console.log(r.pools)
    return r
  }, [pools])

  // useEffect(() => {
  //   async function fetchPool() {
  //     if (currencyIn && currencyOut) {
  //       let [tk0, tk1] = [currencyIn?.wrapped, currencyOut?.wrapped]
  //       if (currencyIn?.wrapped.address !== currencyOut?.wrapped.address) {
  //         ;[tk0, tk1] = currencyIn?.wrapped.sortsBefore(currencyOut?.wrapped)
  //           ? [currencyIn?.wrapped, currencyOut?.wrapped]
  //           : [currencyOut?.wrapped, currencyIn?.wrapped] // does safety checks
  //       }

  //       const token0 = new PublicKey((tk0 as Token).address)
  //       const token1 = new PublicKey((tk1 as Token).address)
  //       ;[500, 3000, 10_000].forEach(async (fee) => {
  //         const generatedAddr = (
  //           await PublicKey.findProgramAddress(
  //             [POOL_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee)],
  //             PROGRAM_ID
  //           )
  //         )[0]
  //         // console.log('generated address', generatedAddr.toString(), ' for fee', fee)
  //         try {
  //           const poolInfo = await connection.getAccountInfo(generatedAddr)
  //           if (poolInfo) {
  //             setAddr((prevState) => [...prevState, generatedAddr])
  //           }
  //         } catch (error) {
  //           console.log('failed to get pool info', error)
  //         }
  //       })
  //     }
  //   }

  //   if (
  //     currencyIn?.wrapped.address != currencyOut?.wrapped.address &&
  //     currencyIn?.wrapped.address &&
  //     currencyOut?.wrapped.address
  //   ) {
  //     fetchPool()
  //   }
  // }, [currencyIn, currencyOut])

  // // console.log('before return from swap Pools')
  // return useMemo(() => {
  //   return {
  //     pools: [...new Set(poolAddr)],
  //     loading: false,
  //   }
  // }, [currencyIn, currencyOut])

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
