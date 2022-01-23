import { Token, Price } from '@uniswap/sdk-core'
import { tickToPrice, TickMath } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'

export function getTickToPrice(baseToken?: Token, quoteToken?: Token, tick?: number): Price<Token, Token> | undefined {
  if (!baseToken || !quoteToken || typeof tick !== 'number') {
    return undefined
  }
  // console.log(`getTickToPrice base${baseToken.name} quote${quoteToken.name} tick ${tick}`)

  // const Q32 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(32))
  // const Q64 = JSBI.exponentiate(Q32, JSBI.BigInt(2))
  // const sqrtRatioX32 = TickMath.getSqrtRatioAtTick(tick)
  // // console.log(`sqrtPriceX32 from tick is ${sqrtRatioX32.toString()}`)

  // const ratioX64 = JSBI.multiply(sqrtRatioX32, sqrtRatioX32)

  // const decimalDiff =
  //   baseToken.decimals > quoteToken.decimals
  //     ? baseToken.decimals - quoteToken.decimals
  //     : quoteToken.decimals - baseToken.decimals
  // const decimalMul = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimalDiff))

  // if (baseToken.decimals < quoteToken.decimals) {
  //   const p = new Price(baseToken, quoteToken, Q64, JSBI.multiply(ratioX64, JSBI.BigInt(decimalMul)))
  //   // console.log(`TT calculated price is ${p.toSignificant()}`)
  //   return p
  // } else {
  //   // WSOL USDC
  //   // USDC WSOL (invert)
  //   const p = new Price(baseToken, quoteToken, Q64, JSBI.divide(ratioX64, decimalMul))
  //   // console.log(`TF calculated price is ${p.toSignificant()}`)
  //   return p
  // }
  // console.log('getTickPrice')
  return tickToPrice(baseToken, quoteToken, tick)
}
