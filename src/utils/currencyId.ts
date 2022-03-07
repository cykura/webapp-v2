import { Currency } from '@cykura/sdk-core'
import { SOLCYS_LOCAL } from 'constants/tokens'

export function currencyId(currency: Currency): string {
  // return wSOL address local
  if (currency.isNative) return SOLCYS_LOCAL.address.toString()
  if (currency.isToken) return currency.address.toString()
  throw new Error('invalid currency')
}
