import { TICK_SPACINGS, u32ToSeed, CyclosCore, IDL } from '@cykura/sdk'
import * as anchor from '@project-serum/anchor'
import { useSolana } from '@saberhq/use-solana'
import { PROGRAM_ID_STR } from '../constants/addresses'
import { Token, Currency } from '@cykura/sdk-core'
import { useEffect, useState } from 'react'
import { useActiveWeb3ReactSol } from './web3'
import { Pool, FeeAmount } from '@cykura/sdk'
import { POOL_SEED } from 'constants/tokens'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import JSBI from 'jsbi'
import { SolanaTickDataProvider } from './useSwapCallback'
import { PublicKey } from '@solana/web3.js'

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

/**
 * Returns the states for a list of pools
 * @param poolKeys
 */
export function usePools(
  poolKeys: {
    tokenA: Token
    tokenB: Token
    fee: FeeAmount
  }[]
) {
  const { connection, wallet } = useSolana()
  const provider = new anchor.Provider(connection, wallet as Wallet, {})
  const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)
  const [poolStates, setPoolStates] = useState<(Pool | undefined)[]>()

  useEffect(() => {
    async function fetchPools() {
      const poolAddresses: PublicKey[] = []
      const sortedPoolKeys = [] as {
        token0: Token
        token1: Token
        fee: FeeAmount
      }[]

      for (const { tokenA, tokenB, fee } of poolKeys) {
        const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
        const [address] = await anchor.web3.PublicKey.findProgramAddress(
          [POOL_SEED, token0.address.toBuffer(), token1.address.toBuffer(), u32ToSeed(fee)],
          cyclosCore.programId
        )
        poolAddresses.push(address)
        sortedPoolKeys.push({ token0, token1, fee })
      }

      const fetchedPools = (await cyclosCore.account.poolState.fetchMultiple(poolAddresses)) as (CyclosPool | null)[]
      const poolObjects: (Pool | undefined)[] = []
      for (const i in fetchedPools) {
        const pool = fetchedPools[i]
        if (pool) {
          const { token0, token1, fee } = sortedPoolKeys[i]
          const tickProvider = new SolanaTickDataProvider(cyclosCore, {
            token0: token0.address,
            token1: token1.address,
            fee,
          })
          await tickProvider.eagerLoadCache(pool.tick, TICK_SPACINGS[fee])

          const poolObject = pool
            ? new Pool(
                token0,
                token1,
                fee,
                JSBI.BigInt(pool.sqrtPriceX32.toString()),
                JSBI.BigInt(pool.liquidity.toString()),
                Number(pool.tick),
                tickProvider
              )
            : undefined
          poolObjects.push(poolObject)
        } else {
          poolObjects.push(undefined)
        }
      }
      setPoolStates(poolObjects)
    }

    fetchPools()

    return () => {
      setPoolStates(undefined)
    }
  }, [poolKeys])
  return poolStates
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

        const [poolState] = await anchor.web3.PublicKey.findProgramAddress(
          [POOL_SEED, tk0.toBuffer(), tk1.toBuffer(), u32ToSeed(feeAmount)],
          cyclosCore.programId
        )

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

    return () => {
      setPoolState(null)
    }
  }, [chainId, account, currencyA, currencyB, feeAmount])

  return poolState
}
