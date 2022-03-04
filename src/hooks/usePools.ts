import { u32ToSeed } from '@cykura/sdk'
import * as anchor from '@project-serum/anchor'
import { useSolana } from '@saberhq/use-solana'
import { PROGRAM_ID_STR, V3_CORE_FACTORY_ADDRESSES } from '../constants/addresses'
import { Token, Currency } from '@cykura/sdk-core'
import { useEffect, useMemo, useState } from 'react'
import { useActiveWeb3ReactSol } from './web3'

import { Pool, FeeAmount } from '@cykura/sdk'
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

      const mapPoolStates = {}
      poolStates.forEach((pState: any) => {
        mapPoolStates[pState.publicKey.toString()] = pState
      })

      // console.log(mapPoolStates)
      setPoolAddresses(poolList)
      setAllFetchedPoolStates(mapPoolStates)
      setLoading(false)
    }
    fetchPoolState()
  }, [chainId, transformed, poolKeys])

  // const allFetchedPoolStatesCopy = allFetchedPoolStates.slice()

  return useMemo(() => {
    // if (allFetchedPoolStates.length == 0) {
    //   return [PoolState.LOADING, null, undefined]
    // }
    // console.log(loading, poolAddresses, allFetchedPoolStates)

    if (!loading && allFetchedPoolStates.length == 0 && poolAddresses.length == 0) {
      // console.log('Something went wrong')
      return transformed.map((i) => [PoolState.INVALID, null])
    }

    if (loading && allFetchedPoolStates.length == 0) {
      // console.log('LOADING')
      return transformed.map((i) => [PoolState.LOADING, null])
    }

    // const allFetchedPublicKeys = allFetchedPoolStates.map((p: any, i: any) => Object.keys(p))
    const allFetchedPublicKeys = Object.keys(allFetchedPoolStates)
    // console.log("PK 's of all fetched pool states", allFetchedPublicKeys)
    const existingPools = poolAddresses.map((p: any) =>
      allFetchedPublicKeys.flat(1).includes(p.toString()) ? true : false
    )
    // console.log(
    //   "PK's of all constructed pools",
    //   poolAddresses.map((p: any) => p)
    // )
    // console.log(
    //   "pools in fetched PK's",
    //   existingPools.map((i: any) => i)
    // )

    return existingPools.map((key: any, index: any) => {
      const [token0, token1, fee] = transformed[index] ?? []

      const poolAdd = poolAddresses[index]

      if (!key || !token0 || !token1 || !fee || !poolAdd) {
        // console.log('invalid becuase cant pubkey in fetched records')
        return [PoolState.NOT_EXISTS, null]
      }

      // console.log(token0?.symbol, token1?.symbol, fee, poolAddresses[index])
      // console.log(allFetchedPoolStates)
      const poolState = allFetchedPoolStates[poolAdd]
      // console.log(poolState)
      if (!poolState) {
        // console.log('invalid becasue no state not found')
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
      // console.log(sqrtPriceX32, liquidity, tick)

      if (!sqrtPriceX32.toString() || !liquidity.toString()) {
        console.log('comes inside?')
        return [PoolState.NOT_EXISTS, null]
      }

      try {
        // If can't find public key from constructed list
        const pubkey = poolAddresses[index]
        if (!pubkey || !token0Add || !token1Add || !poolFee) return [PoolState.NOT_EXISTS, null]
        // console.log('RETURNED', token0.symbol, token1.symbol, poolFee)
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
  }, [loading, transformed, poolKeys])
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
