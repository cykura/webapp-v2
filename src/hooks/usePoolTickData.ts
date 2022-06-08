import { Currency } from '@cykura/sdk-core'
import { FeeAmount, tickToPrice, TICK_SPACINGS, CyclosCore, IDL } from '@cykura/sdk'
import JSBI from 'jsbi'
import { usePool } from './usePools'
import { useEffect, useMemo, useState } from 'react'
import computeSurroundingTicks from 'utils/computeSurroundingTicks'
// import { useAllV3TicksQuery } from 'state/data/enhanced'
import { PublicKey } from '@solana/web3.js'
import * as anchor from '@project-serum/anchor'
import { useSolana } from '@saberhq/use-solana'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { PROGRAM_ID_STR } from 'constants/addresses'
import { SolanaTickDataProvider } from './useSwapCallback'

// Tick with fields parsed to JSBIs, and active liquidity computed.
export interface TickProcessed {
  tickIdx: number
  liquidityActive: JSBI
  liquidityNet: JSBI
  price0: string
}

const getActiveTick = (tickCurrent: number | undefined, feeAmount: FeeAmount | undefined) =>
  tickCurrent && feeAmount ? Math.floor(tickCurrent / TICK_SPACINGS[feeAmount]) * TICK_SPACINGS[feeAmount] : undefined

// Fetches all ticks for a given pool
export function useAllV3Ticks(
  currencyA: Currency | undefined,
  currencyB: Currency | undefined,
  feeAmount: FeeAmount | undefined
) {
  const { connection, wallet } = useSolana()

  const pool = usePool(currencyA, currencyB, feeAmount)

  const provider = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: false,
  })
  const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)

  const [ticks, setTicks] = useState<any>()

  useEffect(() => {
    async function fetchTicks() {
      if (!currencyA || !currencyB || !feeAmount || !pool) return

      // Sort in order to fetch pools properly
      const [t0, t1] = currencyA.wrapped.sortsBefore(currencyB.wrapped)
        ? [currencyA.wrapped, currencyB.wrapped]
        : [currencyB.wrapped, currencyA.wrapped]

      const tickDataProvider = new SolanaTickDataProvider(cyclosCore, {
        token0: new PublicKey(t0.address),
        token1: new PublicKey(t1.address),
        fee: feeAmount,
      })

      await tickDataProvider.eagerLoadCache(pool.tickCurrent, TICK_SPACINGS[feeAmount])

      setTicks(tickDataProvider.tickCache)
    }
    fetchTicks()
  }, [currencyA, currencyB, feeAmount, pool])

  if (!ticks) {
    return {
      isLoading: true,
      isError: false,
      ticks: [],
    }
  } else {
    return {
      isLoading: false,
      isError: false,
      ticks: ticks,
    }
  }
}

export function usePoolActiveLiquidity(
  currencyA: Currency | undefined,
  currencyB: Currency | undefined,
  feeAmount: FeeAmount | undefined
): {
  isLoading: boolean
  isUninitialized: boolean
  isError: boolean
  activeTick: number | undefined
  error: any
  data: TickProcessed[]
} {
  const pool = usePool(currencyA, currencyB, feeAmount)

  const { isLoading, isError, ticks } = useAllV3Ticks(currencyA, currencyB, feeAmount)

  // Find nearest valid tick for pool in case tick is not initialized.
  const activeTick = useMemo(() => getActiveTick(pool?.tickCurrent, feeAmount), [pool, feeAmount])

  return useMemo(() => {
    if (!currencyA || !currencyB || !activeTick || !pool || !ticks || ticks.length === 0) {
      return {
        isLoading: true,
        isUninitialized: false,
        isError: false,
        activeTick: undefined,
        error: null,
        data: [],
      }
    }

    const token0 = currencyA?.wrapped
    const token1 = currencyB?.wrapped

    // To mathc the UNI chart type
    const ticksArray = Array.from(ticks).map((t: any) => ({
      tick: t[0],
      liquidityNet: t[1].liquidityNet.toString(),
      price0: tickToPrice(token0, token1, t[0]),
      price1: tickToPrice(token1, token0, t[0]),
    }))

    // console.log(ticksArray.map((t) => `${t.tick} ${t.price0.toSignificant()} ${t.price1.toSignificant()}`))
    // console.log(activeTick)

    const pivot = Object.values(ticksArray).findIndex(({ tick }: any) => tick > activeTick) - 1

    // console.log(pivot)

    if (pivot < 0) {
      // consider setting a local error
      console.error('TickData pivot not found')
      return {
        isLoading,
        isUninitialized: false,
        isError,
        error: null,
        activeTick,
        data: [],
      }
    }

    const activeTickProcessed: TickProcessed = {
      liquidityActive: JSBI.BigInt(pool[1]?.liquidity ?? 0),
      tickIdx: activeTick,
      liquidityNet:
        Number(ticksArray[pivot].tick) === activeTick ? JSBI.BigInt(ticksArray[pivot].liquidityNet) : JSBI.BigInt(0),
      price0: tickToPrice(token0, token1, activeTick).toFixed(8),
    }

    const subsequentTicks = computeSurroundingTicks(token0, token1, activeTickProcessed, ticksArray, pivot, true)

    const previousTicks = computeSurroundingTicks(token0, token1, activeTickProcessed, ticksArray, pivot, false)

    const ticksProcessed = previousTicks.concat(activeTickProcessed).concat(subsequentTicks)

    return {
      isLoading: isLoading,
      isUninitialized: true,
      isError: isError,
      activeTick,
      error: null,
      data: ticksProcessed,
    }
  }, [currencyA, currencyB, activeTick, pool, ticks, isLoading, isError])
}
