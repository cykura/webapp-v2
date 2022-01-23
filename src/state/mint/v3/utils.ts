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
  value?: string,
  invertPrice?: boolean
): number | undefined {
  if (!baseToken || !quoteToken || !feeAmount || !value) {
    return undefined
  }

  // console.log('inside tryParse Tick', baseToken.name, quoteToken.name, value)
  // base token fixed at 1 unit, quote token amount based on typed input
  const amount = tryParseAmount(value, quoteToken)
  const amountOne = tryParseAmount('1', baseToken)
  // console.log(`tryParseTick\tamount ${amount?.toSignificant()}\tamountOne ${amountOne?.toSignificant()}`)

  if (!amount || !amountOne) return undefined

  // parse the typed value into a price
  const price = new Price(baseToken, quoteToken, amountOne.quotient, amount.quotient)
  let modifiedPrice = new Price(baseToken, quoteToken, amountOne.quotient, amount.quotient)

  if (baseToken?.decimals == quoteToken?.decimals) {
    modifiedPrice = price
  } else {
    // calculate decimals
    const decimalDiff =
      baseToken.decimals > quoteToken.decimals
        ? baseToken.decimals - quoteToken.decimals
        : quoteToken.decimals - baseToken.decimals
    const decimalMul = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimalDiff))

    // Ticks calculated here maintain insertion order in the pool
    if (invertPrice) {
      if (baseToken.decimals < quoteToken.decimals) {
        // USDC WSOL (invert)
        // console.log('True and True ticks')
        modifiedPrice = new Price(baseToken, quoteToken, amountOne.quotient, JSBI.divide(amount.quotient, decimalMul))
      } else {
        // WSOL USDT (invert)
        // console.log('True and False ticks')
        modifiedPrice = new Price(quoteToken, baseToken, amount.quotient, JSBI.divide(amountOne.quotient, decimalMul))
      }
    } else {
      if (baseToken.decimals < quoteToken.decimals) {
        // USDT WSOL
        // console.log('False and True ticks')
        modifiedPrice = new Price(quoteToken, baseToken, JSBI.divide(amount.quotient, decimalMul), amountOne.quotient)
      } else {
        // WSOL USDC
        // console.log('False and False ticks')
        modifiedPrice = new Price(baseToken, quoteToken, JSBI.divide(amountOne.quotient, decimalMul), amount.quotient)
      }
    }
  }

  let tick: number
  // check price is within min/max bounds, if outside return min/max
  const sqrtRatioX32 = encodeSqrtRatioX32(price.numerator, price.denominator)

  if (JSBI.greaterThanOrEqual(sqrtRatioX32, TickMath.MAX_SQRT_RATIO)) {
    tick = TickMath.MAX_TICK
  } else if (JSBI.lessThanOrEqual(sqrtRatioX32, TickMath.MIN_SQRT_RATIO)) {
    tick = TickMath.MIN_TICK
  } else {
    // this function is agnostic to the base, will always return the correct tick
    // console.log(
    //   `to calculate ticks this price is used ${modifiedPrice.quotient} nr ${modifiedPrice.numerator} dr ${modifiedPrice.denominator}`
    // )
    tick = priceToClosestTick(modifiedPrice)
  }
  // console.log(
  //   `TRY PARSE TICK CALC\nentered ${quoteToken?.symbol} is ${value.toString()}\n${baseToken?.symbol} is 1\n ${price
  //     .quote(amountOne)
  //     .toSignificant()}\ntick calcualted is ${tick.toString()}`
  // )

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
