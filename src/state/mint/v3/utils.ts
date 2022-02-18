import {
  priceToClosestTick,
  nearestUsableTick,
  FeeAmount,
  TICK_SPACINGS,
  encodeSqrtRatioX32,
  TickMath,
} from '@uniswap/v3-sdk/dist/'
import { Price, Token } from '@uniswap/sdk-core'
import { tryParseAmount } from 'state/swap/hooks'
import JSBI from 'jsbi'

export function tryParseTick(
  baseToken?: Token,
  quoteToken?: Token,
  feeAmount?: FeeAmount,
  value?: string
): number | undefined {
  if (!baseToken || !quoteToken || !feeAmount || !value) {
    return undefined
  }

  // base token fixed at 1 unit, quote token amount based on typed input
  const amount = tryParseAmount(value, quoteToken)
  const amountOne = tryParseAmount('1', baseToken)

  if (!amount || !amountOne) return undefined

  // parse the typed value into a price
  const price = new Price(baseToken, quoteToken, amountOne.quotient, amount.quotient)

  let tick: number
  // check price is within min/max bounds, if outside return min/max
  const sqrtRatioX32 = encodeSqrtRatioX32(price.numerator, price.denominator)

  if (JSBI.greaterThanOrEqual(sqrtRatioX32, TickMath.MAX_SQRT_RATIO)) {
    tick = TickMath.MAX_TICK
  } else if (JSBI.lessThanOrEqual(sqrtRatioX32, TickMath.MIN_SQRT_RATIO)) {
    tick = TickMath.MIN_TICK
  } else {
    tick = priceToClosestTick(price)
  }

  return nearestUsableTick(tick, TICK_SPACINGS[feeAmount])
}

// CYS Helpers
// move to SDK
// Generate seed buffer from a u32 number
export function u16ToSeed(num: number) {
  const arr = new ArrayBuffer(2)
  const view = new DataView(arr)
  view.setUint16(0, num, false)
  return new Uint8Array(arr)
}
