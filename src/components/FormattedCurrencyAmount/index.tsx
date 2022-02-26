import JSBI from 'jsbi'
import { Currency, CurrencyAmount, Fraction } from '@uniswap/sdk-core'

const CURRENCY_AMOUNT_MIN = new Fraction(JSBI.BigInt(1), JSBI.BigInt(1000000))

export default function FormattedCurrencyAmount({
  currencyAmount,
  significantDigits = 4,
}: {
  currencyAmount: CurrencyAmount<Currency>
  significantDigits?: number
}) {
  return (
    <>
      {currencyAmount.equalTo(0)
        ? '0'
        : currencyAmount.greaterThan(CURRENCY_AMOUNT_MIN)
        ? currencyAmount.toSignificant(6)
        : `<${CURRENCY_AMOUNT_MIN.toSignificant(1)}`}
    </>
  )
}
