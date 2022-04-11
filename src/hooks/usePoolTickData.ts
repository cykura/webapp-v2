import { Currency } from '@cykura/sdk-core'
import { FeeAmount, nearestUsableTick, Pool, tickPosition, TICK_SPACINGS, CyclosCore, IDL } from '@cykura/sdk'
import JSBI from 'jsbi'
import { usePool } from './usePools'
import { useEffect, useMemo, useState } from 'react'
import computeSurroundingTicks from 'utils/computeSurroundingTicks'
// import { useAllV3TicksQuery } from 'state/data/enhanced'
import { skipToken } from '@reduxjs/toolkit/query/react'
import { PublicKey } from '@solana/web3.js'
// import { AllV3TicksQuery } from 'state/data/generated'
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

const bitmapIndex = (tick: number, tickSpacing: number, lte: boolean) => {
  // console.log(tick, tickSpacing)
  // return Math.floor(tick / tickSpacing / 255)
  let compressed = tick / tickSpacing

  if (tick < 0 && tick % tickSpacing !== 0) {
    // console.log('deducting from compressed.')
    compressed -= 1
  }

  if (!lte) {
    // console.log('lte is false, +1 to compressed')
    compressed += 1
  }
  const { wordPos, bitPos } = tickPosition(compressed)

  return bitPos
}

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

  useEffect(() => {
    async function fetchTicks() {
      if (!currencyA || !currencyB || !feeAmount || !pool) return

      const poolAddress = await Pool.getAddress(currencyA?.wrapped, currencyB?.wrapped, feeAmount)

      const tickSpacing = feeAmount && TICK_SPACINGS[feeAmount]
      console.log(tickSpacing, ' tickSpacing', pool?.tickCurrent, ' tickCurrent')

      // Find nearest valid tick for pool in case tick is not initialized.
      const activeTick = pool?.tickCurrent && tickSpacing ? nearestUsableTick(pool.tickCurrent, tickSpacing) : undefined
      console.log(activeTick, 'activeTick')

      if (!activeTick) return

      // it is also possible to grab all tick data but it is extremely slow
      // Fetch these many ticks nearby for now
      const numSurroundingTicks = 125
      // bitmapIndex(nearestUsableTick(TickMath.MIN_TICK, tickSpacing), tickSpacing)

      const lte = currencyA.wrapped.sortsBefore(currencyB.wrapped)

      const minIndex = tickSpacing
        ? bitmapIndex(activeTick! - numSurroundingTicks * tickSpacing, tickSpacing, lte)
        : undefined

      const maxIndex = tickSpacing
        ? bitmapIndex(activeTick! + numSurroundingTicks * tickSpacing, tickSpacing, lte)
        : undefined

      // These dont work as bitmapIndex doesnt work rn
      // console.log(minIndex, 'minIndex', maxIndex, 'maxIndex')

      // const tickLensArgs: [PublicKey, number][] =
      //   maxIndex && minIndex && poolAddress
      //     ? new Array(maxIndex - minIndex + 1)
      //         .fill(0)
      //         .map((_, i) => i + minIndex)
      //         .map((wordIndex) => [poolAddress, wordIndex])
      //     : []

      // console.log(tickLensArgs)

      const tickDataProvider = new SolanaTickDataProvider(cyclosCore, {
        token0: new PublicKey(currencyA.wrapped.address),
        token1: new PublicKey(currencyB.wrapped.address),
        fee: feeAmount,
      })

      const [nextTick, initialized, wordPos, bitPos, bitmapState] =
        await tickDataProvider.nextInitializedTickWithinOneWord(pool.tickCurrent, lte, tickSpacing)

      console.log(
        'nextTick',
        nextTick,
        'initialized',
        initialized,
        'wordPos',
        wordPos,
        'bitPos',
        bitPos,
        bitmapState.toString()
      )

      const data = await tickDataProvider.getTick(nextTick)

      const prevTicks = new Array(10)
        .fill(0)
        .map((_, i) => nextTick - (i + 1) * tickSpacing)
        .reverse()

      const nextTicks = new Array(10).fill(0).map((_, i) => nextTick + (i + 1) * tickSpacing)

      const ticks = prevTicks.concat(nextTick).concat(nextTicks)

      const result = Promise.all(ticks.map(async (tick) => await tickDataProvider.getTick(tick)))

      console.log(result)
    }
    fetchTicks()
  }, [currencyA, currencyB, feeAmount, pool])

  // const [poolAddress, setPoolAddress] = useState<PublicKey | undefined>()
  // if (currencyA && currencyB && feeAmount) {
  //   Pool.getAddress(currencyA?.wrapped, currencyB?.wrapped, feeAmount).then((address) => {
  //     setPoolAddress(address)
  //   })
  // }

  //TODO(judo): determine if pagination is necessary for this query
  // const { isLoading, isError, data } = useAllV3TicksQuery(
  //   poolAddress ? { poolAddress: poolAddress?.toLowerCase(), skip: 0 } : skipToken,
  //   {
  //     pollingInterval: ms`2m`,
  //   }
  // )

  return {
    isLoading: false,
    isError: false,
    ticks: [],
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
  const [ticksProcessed, setTicksProcessed] = useState<TickProcessed[]>([])

  const pool = usePool(currencyA, currencyB, feeAmount)

  const { isLoading, isError, ticks } = useAllV3Ticks(currencyA, currencyB, feeAmount)

  // Find nearest valid tick for pool in case tick is not initialized.
  const activeTick = useMemo(() => getActiveTick(pool?.tickCurrent, feeAmount), [pool, feeAmount])

  // useEffect(() => {
  //   if (!currencyA || !currencyB || !activeTick || !pool || !ticks || ticks.length === 0) {
  //     setTicksProcessed([])
  //     return
  //   }

  //   const token0 = currencyA?.wrapped
  //   const token1 = currencyB?.wrapped

  //   const sortedTickData = cloneDeep(ticks as any['ticks'])
  //   sortedTickData.sort((a: { tickIdx: number }, b: { tickIdx: number }) => a.tickIdx - b.tickIdx)

  //   // find where the active tick would be to partition the array
  //   // if the active tick is initialized, the pivot will be an element
  //   // if not, take the previous tick as pivot
  //   const pivot = sortedTickData.findIndex(({ tickIdx }: any) => tickIdx > activeTick) - 1

  //   if (pivot < 0) {
  //     // consider setting a local error
  //     console.error('TickData pivot not found')
  //     return
  //   }

  //   const activeTickProcessed: TickProcessed = {
  //     liquidityActive: JSBI.BigInt(pool[1]?.liquidity ?? 0),
  //     tickIdx: activeTick,
  //     liquidityNet:
  //       sortedTickData[pivot].tickIdx === activeTick ? JSBI.BigInt(sortedTickData[pivot].liquidityNet) : JSBI.BigInt(0),
  //     price0: tickToPrice(token0, token1, activeTick).toFixed(PRICE_FIXED_DIGITS),
  //   }

  //   const subsequentTicks = computeSurroundingTicks(token0, token1, activeTickProcessed, sortedTickData, pivot, true)

  //   const previousTicks = computeSurroundingTicks(token0, token1, activeTickProcessed, sortedTickData, pivot, false)

  //   const newTicksProcessed = previousTicks.concat(activeTickProcessed).concat(subsequentTicks)

  //   setTicksProcessed(newTicksProcessed)
  // }, [currencyA, currencyB, activeTick, pool, ticks])

  return {
    isLoading: isLoading,
    isUninitialized: true,
    isError: isError,
    activeTick,
    error: null,
    data: ticksProcessed,
  }
}
