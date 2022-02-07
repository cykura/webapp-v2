import { Currency, CurrencyAmount, Price, Token } from '@uniswap/sdk-core'
import { useMemo } from 'react'
import { SOLUSDC, SOLUSDC_LOCAL, SOLUSDC_MAIN } from '../constants/tokens'
import { useBestV3TradeExactOut } from './useBestV3Trade'
import { useActiveWeb3ReactSol } from './web3'
import JSBI from 'jsbi'

// Stablecoin amounts used when calculating spot price for a given currency.
// The amount is large enough to filter low liquidity pairs.
const STABLECOIN_AMOUNT_OUT: { [chainId: number]: CurrencyAmount<Token> } = {
  101: CurrencyAmount.fromRawAmount(SOLUSDC_MAIN, 1000_000),
  104: CurrencyAmount.fromRawAmount(SOLUSDC_LOCAL, 1000_000),
  103: CurrencyAmount.fromRawAmount(SOLUSDC_LOCAL, 1000_000),
}

/**
 * Returns the price in USDC of the input currency
 * @param currency currency to compute the USDC price of
 */
export default function useUSDCPrice(currency?: Currency): Price<Currency, Token> | undefined {
  // return undefined
  const { chainId } = useActiveWeb3ReactSol()

  const amountOut = chainId ? STABLECOIN_AMOUNT_OUT[chainId] : undefined
  const stablecoin = amountOut?.currency

  const v3USDCTrade = useBestV3TradeExactOut(currency, amountOut)

  return useMemo(() => {
    if (!currency || !stablecoin) {
      return undefined
    }

    // const invert = currency?.equals(stablecoin)
    // console.log(invert, ' is invert?')

    // handle usdc
    if (currency?.wrapped.equals(stablecoin)) {
      // console.log('Fetching USDC price')
      return new Price(stablecoin, stablecoin, '1', '1')
    }

    // Not sure if this is right
    if (v3USDCTrade.trade) {
      // console.log('fetching price of', currency.name)
      const { numerator, denominator } = v3USDCTrade.trade.inputAmount
      // const { numerator, denominator } = v3USDCTrade.trade.route.midPrice
      // return new Price(currency, stablecoin, denominator, numerator)
      // Could break for other tokens, Tested only for CYS. Need to test extensively.
      const price = new Price(
        currency,
        stablecoin,
        numerator,
        JSBI.multiply(denominator, JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(currency.decimals)))
      )
      console.log('$', price.toSignificant())
      return price
    }

    // //handle usdt
    // if (currency?.wrapped.symbol === 'USDT') {
    //   // console.log('Fetching USDT price')
    //   return new Price(currency?.wrapped, stablecoin, '1', '1')
    // }
    return undefined
  }, [currency, stablecoin, v3USDCTrade.trade])
}

export function useUSDCValue(currencyAmount: CurrencyAmount<Currency> | undefined | null) {
  const price = useUSDCPrice(currencyAmount?.currency)

  return useMemo(() => {
    if (!price || !currencyAmount) return null
    try {
      return price.quote(currencyAmount)
    } catch (error) {
      return null
    }
  }, [currencyAmount, price])
}
