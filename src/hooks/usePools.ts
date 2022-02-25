import { u32ToSeed } from '@uniswap/v3-sdk'
import * as anchor from '@project-serum/anchor'
import { useSolana } from '@saberhq/use-solana'
import { PROGRAM_ID_STR, V3_CORE_FACTORY_ADDRESSES } from '../constants/addresses'
import { Token, Currency } from '@uniswap/sdk-core'
import { useEffect, useMemo, useState } from 'react'
import { useActiveWeb3ReactSol } from './web3'

import { Pool, FeeAmount } from '@uniswap/v3-sdk'
import { POOL_SEED, SOLUSDC_LOCAL, SOLUSDT_LOCAL } from 'constants/tokens'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import JSBI from 'jsbi'
import { SolanaTickDataProvider } from './useSwapCallback'
import { CyclosCore, IDL } from 'types/cyclos-core'
import { PublicKey } from '@solana/web3.js'
// import usePrevious from './usePrevious'

// const POOL_STATE_INTERFACE = new Interface(IUniswapV3PoolStateABI) as IUniswapV3PoolStateInterface

export enum PoolState {
  LOADING,
  NOT_EXISTS,
  EXISTS,
  INVALID,
}

export type CyclosPool = {
  token0: PublicKey | undefined
  token1: PublicKey | undefined
  fee: FeeAmount | undefined
  sqrtPriceX32: JSBI
  liquidity: JSBI
  tick: number
}

export function usePools(
  poolKeys: [Currency | undefined, Currency | undefined, FeeAmount | undefined][]
): [PoolState, Pool | null][] {
  const { chainId } = useActiveWeb3ReactSol()
  const { connection, wallet } = useSolana()

  // console.log(
  //   'usePools called with',
  //   poolKeys.map((p) => `${p[0]?.symbol} ${p[1]?.symbol} ${p[2]?.toString()}`)
  // )

  const provider = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: false,
  })
  const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)

  // Stores Pool Addresses of transformed list
  const [poolAddresses, setPoolAddresses] = useState<(string | undefined)[]>([])
  // FIX type here
  const [allFetchedPoolStates, setAllFetchedPoolStates] = useState<any>([])
  const [loading, setLoading] = useState<boolean>(false)

  // const prevPoolAddresses = usePrevious(poolAddresses)
  // const prevAllFetchedPoolStates = usePrevious(allFetchedPoolStates)

  // if (!poolAddresses || !allFetchedPoolStates) {
  //   setPoolAddresses(prevPoolAddresses!)
  //   setAllFetchedPoolStates(prevAllFetchedPoolStates)
  // }

  const transformed: ([Token, Token, FeeAmount] | null)[] = useMemo(() => {
    return poolKeys.map(([currencyA, currencyB, feeAmount]) => {
      if (!chainId || !currencyA || !currencyB || !feeAmount) return null

      const tokenA = currencyA?.wrapped
      const tokenB = currencyB?.wrapped
      if (!tokenA || !tokenB || tokenA.equals(tokenB)) return null
      const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
      return [token0, token1, feeAmount]
    })
  }, [chainId, poolKeys])

  useEffect(() => {
    async function fetchPoolState() {
      setLoading(true)
      const poolStates = await cyclosCore.account.poolState.all()
      const poolList = await Promise.all(
        transformed.map(async (value) => {
          if (!value) return undefined
          try {
            const [tokenA, tokenB, feeAmount] = value

            const tk0 = new anchor.web3.PublicKey(tokenA.address)
            const tk1 = new anchor.web3.PublicKey(tokenB.address)
            const [poolState, _] = await anchor.web3.PublicKey.findProgramAddress(
              [POOL_SEED, tk0.toBuffer(), tk1.toBuffer(), u32ToSeed(feeAmount)],
              cyclosCore.programId
            )
            return poolState.toString()
          } catch (e) {
            setLoading(false)
            console.log(value)
            console.log('ERROR ', e)
            return ''
          }
        })
      )

      // const allFetchedPublicKeys = poolStates.map((p: any) => p.publicKey.toString())
      // const existingPools = poolList.map((p: any) => (allFetchedPublicKeys.includes(p.toString()) ? true : false))

      // console.log(allFetchedPublicKeys.map((p: any) => p.toString()))
      // console.log(existingPools.map((p, i) => `${p} ${poolList[i]}`))
      // console.log(existingPools)
      // console.log(poolList.map((r) => r?.toString()))
      setPoolAddresses(poolList)
      // console.log(poolStates.map((p: any) => p.publicKey.toString()))
      setAllFetchedPoolStates(poolStates)
      setLoading(false)
    }
    fetchPoolState()
  }, [chainId, transformed, poolKeys])

  // Pool State returned
  // bump: 255
  // fee: 3000
  // feeGrowthGlobal0X32: BN {negative: 0, words: Array(3), length: 1, red: null}
  // feeGrowthGlobal1X32: BN {negative: 0, words: Array(3), length: 1, red: null}
  // liquidity: BN {negative: 0, words: Array(3), length: 1, red: null}
  // observationCardinality: 1
  // observationCardinalityNext: 1
  // observationIndex: 0
  // protocolFeesToken0: BN {negative: 0, words: Array(3), length: 1, red: null}
  // protocolFeesToken1: BN {negative: 0, words: Array(3), length: 1, red: null}
  // sqrtPriceX32: BN {negative: 0, words: Array(3), length: 2, red: null}
  // tick: -23028
  // tickSpacing: 60
  // token0: PublicKey {_bn: BN}
  // token1: PublicKey {_bn: BN}
  // unlocked: true

  // console.log(poolAddresses, allFetchedPoolStates)
  // console.log('usePool called')

  // console.log('prev STates ', poolAddresses, allFetchedPoolStates)

  return useMemo(() => {
    // if (allFetchedPoolStates.length == 0) {
    //   return [PoolState.LOADING, null, undefined]
    // }
    // console.log(loading, poolAddresses, allFetchedPoolStates)

    const allFetchedPoolStatesCopy = allFetchedPoolStates.slice()

    if (!loading && allFetchedPoolStatesCopy.length == 0 && poolAddresses.length == 0) {
      // console.log('Something went wrong')
      return transformed.map((i) => [PoolState.INVALID, null])
    }

    if (loading && allFetchedPoolStatesCopy.length == 0) {
      // console.log('LOADING')
      return transformed.map((i) => [PoolState.LOADING, null])
    }

    const allFetchedPublicKeys = poolAddresses.map((p: any, i: any) => p)
    // console.log(allFetchedPublicKeys.map((p) => p))
    const existingPools = poolAddresses.map((p: any) => (allFetchedPublicKeys.includes(p.toString()) ? true : false))
    // console.log(existingPools.map((p: any) => p))

    // console.log(existingPools, poolAddresses, allFetchedPoolStatesCopy)

    return existingPools.map((key: any, index: any) => {
      const [token0, token1, fee] = transformed[index] ?? []
      // console.log(token0?.symbol, token1?.symbol, fee, p[index], poolAddresses[index])
      if (!key || !token0 || !token1 || !fee) {
        // console.log('invalid becuase cant pubkey in fetched records')
        return [PoolState.NOT_EXISTS, null]
      }

      const poolState = allFetchedPoolStatesCopy.shift()
      if (!poolState) {
        // console.log('invalid becasue no state yet')
        return [PoolState.NOT_EXISTS, null]
      }

      const {
        token0: token0Add,
        token1: token1Add,
        fee: poolFee,
        sqrtPriceX32,
        liquidity,
        tick,
      } = poolState.account as CyclosPool
      // console.log(sqrtPriceX32, liquidity, tick, ' poolState taken')
      // const { result: liquidity, loading: liquidityLoading, valid: liquidityValid } = liquidities[index]

      // if (!slot0Valid || !liquidityValid) return [PoolState.INVALID, null]
      // if (slot0Loading || liquidityLoading) return [PoolState.LOADING, null]

      if (!sqrtPriceX32.toString() || !liquidity.toString() || !tick) {
        // console.log('comes inside?')
        return [PoolState.NOT_EXISTS, null]
      }

      try {
        // If can't find public key from constructed list
        const pubkey = poolAddresses[index]
        if (!pubkey || !token0Add || !token1Add || !poolFee) return [PoolState.NOT_EXISTS, null]

        const tickDataProvider = new SolanaTickDataProvider(cyclosCore, {
          token0: new PublicKey(token0Add),
          token1: new PublicKey(token1Add),
          fee: poolFee,
        })
        return [
          PoolState.EXISTS,
          new Pool(
            token0,
            token1,
            poolFee,
            JSBI.BigInt(sqrtPriceX32.toString()),
            JSBI.BigInt(liquidity.toString()),
            Number(tick),
            tickDataProvider
          ),
        ]
      } catch (error) {
        console.error('Error when constructing the pool', error)
        return [PoolState.NOT_EXISTS, null]
      }
    })
  }, [loading, transformed])
  // console.log(r)
  // return r
}

export function usePool(
  currencyA: Currency | undefined,
  currencyB: Currency | undefined,
  feeAmount: FeeAmount | undefined
): Pool | null {
  const { chainId, account } = useActiveWeb3ReactSol()
  const { connection, wallet } = useSolana()

  const provider = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: false,
  })
  const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)

  const [poolState, setPoolState] = useState<Pool | null>(null)

  useEffect(() => {
    async function fetchPool() {
      if (!currencyA?.wrapped || !currencyB?.wrapped || !feeAmount) return

      let [token0, token1] = [currencyA?.wrapped, currencyB?.wrapped]
      if (currencyA?.wrapped.address !== currencyB?.wrapped.address) {
        ;[token0, token1] = currencyA?.wrapped.sortsBefore(currencyB?.wrapped)
          ? [currencyA?.wrapped, currencyB?.wrapped]
          : [currencyB?.wrapped, currencyA?.wrapped] // does safety checks
      }
      try {
        const tk0 = new anchor.web3.PublicKey(token0.address)
        const tk1 = new anchor.web3.PublicKey(token1.address)

        const [poolState, _] = await anchor.web3.PublicKey.findProgramAddress(
          [POOL_SEED, tk0.toBuffer(), tk1.toBuffer(), u32ToSeed(feeAmount)],
          cyclosCore.programId
        )

        // console.log(poolState.toString())
        const slot0 = await cyclosCore.account.poolState.fetch(poolState)

        const tickDataProvider = new SolanaTickDataProvider(cyclosCore, {
          token0: slot0.token0,
          token1: slot0.token1,
          fee: slot0.fee,
        })

        setPoolState(
          new Pool(
            currencyA.wrapped,
            currencyB.wrapped,
            feeAmount,
            JSBI.BigInt(slot0.sqrtPriceX32),
            JSBI.BigInt(slot0.liquidity),
            slot0.tick,
            tickDataProvider
          )
        )
      } catch (e) {
        console.log('Something went wrong!', e)
      }
    }
    fetchPool()
  }, [chainId, account, currencyA, currencyB, feeAmount])

  return poolState
}
