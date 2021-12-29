import { computePoolAddress } from '@uniswap/v3-sdk'
import * as anchor from '@project-serum/anchor'
import { SolanaWalletAdapter, useSolana } from '@saberhq/use-solana'
import idl from '../constants/cyclos-core.json'
import { V3_CORE_FACTORY_ADDRESSES } from '../constants/addresses'
import { IUniswapV3PoolStateInterface } from '../types/v3/IUniswapV3PoolState'
import { Token, Currency } from '@uniswap/sdk-core'
import { useEffect, useMemo, useState } from 'react'
import { useActiveWeb3React, useActiveWeb3ReactSol } from './web3'
import { useMultipleContractSingleData } from '../state/multicall/hooks'

import { Pool, FeeAmount } from '@uniswap/v3-sdk'
import { abi as IUniswapV3PoolStateABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json'
import { Interface } from '@ethersproject/abi'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'

const POOL_STATE_INTERFACE = new Interface(IUniswapV3PoolStateABI) as IUniswapV3PoolStateInterface

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
  const cyclosCore = new anchor.Program(idl as anchor.Idl, '9qe9svzmigVAvWh2qX9AJq3p4N9QbTyx2yRCfN1aAZam', provider)

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
      // const v3CoreFactoryAddress = chainId && V3_CORE_FACTORY_ADDRESSES[chainId]
      const v3CoreFactoryAddress = '9qe9svzmigVAvWh2qX9AJq3p4N9QbTyx2yRCfN1aAZam'

      const poolList = await Promise.all(
        transformed.map(async (value) => {
          if (!v3CoreFactoryAddress || !value) return undefined
          const poolAddress = await computePoolAddress({
            factoryAddress: v3CoreFactoryAddress,
            tokenA: value[0],
            tokenB: value[1],
            fee: value[2],
          })
          return poolAddress
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
): [PoolState, Pool | null] {
  const poolKeys: [Currency | undefined, Currency | undefined, FeeAmount | undefined][] = useMemo(
    () => [[currencyA, currencyB, feeAmount]],
    [currencyA, currencyB, feeAmount]
  )

  return usePools(poolKeys)[0]
}
