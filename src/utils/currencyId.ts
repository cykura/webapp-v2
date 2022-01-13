import { Currency } from '@uniswap/sdk-core'
import { SOLCYS_LOCAL } from 'constants/tokens'

export function currencyId(currency: Currency): string {
  // return wSOL address local
  if (currency.isNative) return SOLCYS_LOCAL.address
  if (currency.isToken) return currency.address
  throw new Error('invalid currency')
}
