import { Token, Price } from '@cykura/sdk-core'
import { tickToPrice } from '@cykura/sdk'

export function getTickToPrice(baseToken?: Token, quoteToken?: Token, tick?: number): Price<Token, Token> | undefined {
  if (!baseToken || !quoteToken || typeof tick !== 'number') {
    return undefined
  }

  return tickToPrice(baseToken, quoteToken, tick)
}
