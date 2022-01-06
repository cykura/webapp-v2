import { u32ToSeed } from '@uniswap/v3-sdk'
import * as anchor from '@project-serum/anchor'
import { useSolana } from '@saberhq/use-solana'
import idl from '../constants/cyclos-core.json'
import { PROGRAM_ID_STR, V3_CORE_FACTORY_ADDRESSES } from '../constants/addresses'
import { Token, Currency } from '@uniswap/sdk-core'
import { useEffect, useMemo, useState } from 'react'
import { useActiveWeb3ReactSol } from './web3'

import { Pool, FeeAmount } from '@uniswap/v3-sdk'
import { POOL_SEED, SOLUSDC_LOCAL, SOLUSDT_LOCAL } from 'constants/tokens'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'

// const POOL_STATE_INTERFACE = new Interface(IUniswapV3PoolStateABI) as IUniswapV3PoolStateInterface

export enum PoolState {
  LOADING,
  NOT_EXISTS,
  EXISTS,
  INVALID,
}

export function usePools(
  poolKeys: [Currency | undefined, Currency | undefined, FeeAmount | undefined][]
): [PoolState, Pool | null][] {
  const { chainId } = useActiveWeb3ReactSol()
  const { connection, wallet } = useSolana()

  const provider = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: false,
  })
  const cyclosCore = new anchor.Program(idl as anchor.Idl, PROGRAM_ID_STR, provider)

  const [poolAddresses, setPoolAddresses] = useState<(string | undefined)[]>([])

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
    ;(async () => {
      const poolList = await Promise.all(
        transformed.map(async (value) => {
          if (!value) return undefined
          try {
            const [tokenA, tokenB, feeAmount] = value
            const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA] // does safety checks

            const tk0 = new anchor.web3.PublicKey(token0.address)
            const tk1 = new anchor.web3.PublicKey(token1.address)
            const [poolAState, poolAStateBump] = await anchor.web3.PublicKey.findProgramAddress(
              [POOL_SEED, tk0.toBuffer(), tk1.toBuffer(), u32ToSeed(feeAmount)],
              cyclosCore.programId
            )
            // console.log('tk0', tokenA.address)
            // console.log('tk1', tokenB.address)
            // console.log('fee', feeAmount)
            // console.log('poolAState', poolAState.toString())
            return poolAState.toString()
          } catch (e) {
            console.log(value)
            console.log('ERROR ', e)
            return undefined
          }
        })
      )
      setPoolAddresses(poolList)
    })()
  }, [chainId, transformed])

  return useMemo(() => {
    return poolKeys.map((_key, index) => {
      const [token0, token1, fee] = transformed[index] ?? []
      if (!token0 || !token1 || !fee) return [PoolState.INVALID, null]

      // const { result: liquidity, loading: liquidityLoading, valid: liquidityValid } = liquidities[index]

      const SOL_poolStatesData: any[] = []
      poolAddresses.forEach(async (poolAddr) => {
        if (poolAddr) {
          try {
            const slot0 = await cyclosCore.account.poolState.fetch(poolAddr)
            SOL_poolStatesData.push(slot0)
          } catch (e) {
            SOL_poolStatesData.push(null)
            console.log('Does not Exist ', e)
          }
        }
      })
      const slot0 = SOL_poolStatesData[index]

      // if (!slot0Valid || !liquidityValid) return [PoolState.INVALID, null]
      // if (slot0Loading || liquidityLoading) return [PoolState.LOADING, null]

      if (!slot0) return [PoolState.NOT_EXISTS, null]

      if (!slot0.sqrtPriceX96 || slot0.sqrtPriceX96.eq(0)) return [PoolState.NOT_EXISTS, null]

      try {
        return [PoolState.EXISTS, new Pool(token0, token1, fee, slot0.sqrtPriceX96, slot0.liquidity, slot0.tick)]
      } catch (error) {
        console.error('Error when constructing the pool', error)
        return [PoolState.NOT_EXISTS, null]
      }
    })
  }, [poolKeys, transformed])
}

export function usePool(
  currencyA: Currency | undefined,
  currencyB: Currency | undefined,
  feeAmount: FeeAmount | undefined
): Pool | null {
  const poolKeys: [Currency | undefined, Currency | undefined, FeeAmount | undefined][] = useMemo(
    () => [[currencyA, currencyB, feeAmount]],
    [currencyA, currencyB, feeAmount]
  )
  const { chainId, account } = useActiveWeb3ReactSol()
  const { connection, wallet } = useSolana()

  const provider = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: false,
  })
  const cyclosCore = new anchor.Program(idl as anchor.Idl, PROGRAM_ID_STR, provider)

  const [poolState, setPoolState] = useState<Pool | null>(null)

  useEffect(() => {
    ;(async () => {
      if (!currencyA?.wrapped || !currencyB?.wrapped || !feeAmount) return
      if (currencyA?.wrapped.address == 'token 0' || currencyB?.wrapped.address == 'token 1') return

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
          [POOL_SEED, tk0.toBuffer(), tk1.toBuffer(), u32ToSeed(500)],
          cyclosCore.programId
        )

        // console.log(poolState.toString())
        const slot0 = await cyclosCore.account.poolState.fetch(poolState)

        setPoolState(
          new Pool(currencyA.wrapped, currencyB.wrapped, feeAmount, slot0.sqrtPriceX32, slot0.liquidity, slot0.tick)
        )
      } catch (e) {
        console.log('Something went wrong!', e)
      }
    })()
  }, [chainId, account, currencyA, currencyB, feeAmount])

  return poolState
}
