import { Currency, CurrencyAmount, Price, Token } from '@uniswap/sdk-core'
import { useMemo } from 'react'
import { SOLUSDC, SOLUSDC_LOCAL, SOLUSDC_MAIN } from '../constants/tokens'
import { useActiveWeb3ReactSol } from './web3'

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

  // const v3USDCTrade = useBestV3TradeExactOut(currency, amountOut)

  return useMemo(() => {
    if (!currency || !stablecoin) {
      return undefined
    }

    // handle usdc
    if (currency?.wrapped.equals(stablecoin)) {
      // console.log('Fetching USDC price')
      return new Price(stablecoin, stablecoin, '1', '1')
    }

    //handle usdt
    if (currency?.wrapped.symbol === 'USDT') {
      // console.log('Fetching USDT price')
      return new Price(currency?.wrapped, stablecoin, '1', '1')
    }

    //handle wsol
    if (currency?.wrapped.symbol === 'wSOL') {
      // console.log('Fetching SOL price')
      return new Price(currency?.wrapped, stablecoin, '1000', '170')
    }
    //handle cys
    if (currency?.wrapped.symbol === 'CYS') {
      // console.log('Fetching CYS price')
      return new Price(currency?.wrapped, stablecoin, '100', '52')
    }
    return undefined
  }, [currency, stablecoin])
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
