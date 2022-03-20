import { Currency, CurrencyAmount, Price, Token } from '@cykura/sdk-core'
import { useEffect, useMemo, useState } from 'react'
import { SOLUSDC_LOCAL, SOLUSDC_MAIN } from '../constants/tokens'
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
 * Gets the number of decimal places in a number
 *
 * @param x A number
 * @returns decimal places
 */
function countDecimals(x: number) {
  if (Math.floor(x.valueOf()) === x.valueOf()) return 0
  return x.toString().split('.')[1].length || 0
}

/**
 * Returns the token price in USDT
 *
 * Uniswap finds the price in USDC from its own pools. Cykura uses Solscan API instead, which
 * returns price in terms of USDT
 *
 * @param currency currency to price of
 */
export default function useUSDTPrice(currency?: Currency): Price<Currency, Token> | undefined {
  const [price, setPrice] = useState<Price<Currency, Token>>()
  const { chainId } = useActiveWeb3ReactSol()
  const amountOut = chainId ? STABLECOIN_AMOUNT_OUT[chainId] : undefined
  const stablecoin = amountOut?.currency

  useEffect(() => {
    async function getPrice() {
      if (currency && stablecoin) {
        const res = await fetch('https://public-api.solscan.io/market/token/' + (currency as Token).address.toString())
        const fetchedPrice = (await res.json())['priceUsdt'] as number
        const decimals = countDecimals(fetchedPrice)
        const priceObj = new Price(
          currency,
          stablecoin,
          JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals + currency.decimals)),
          JSBI.BigInt(fetchedPrice * Math.pow(10, decimals + stablecoin.decimals))
        )
        setPrice(priceObj)
      }
    }
    getPrice()
  }, [currency])

  return price
}

/**
 * Gets the monetary value of the given input token amount, in terms of USDT
 *
 * @param currencyAmount The input base amount
 * @returns
 */
export function useUSDTValue(currencyAmount: CurrencyAmount<Currency> | undefined | null) {
  const price = useUSDTPrice(currencyAmount?.currency)

  return useMemo(() => {
    if (!price || !currencyAmount) return null
    return price.quote(currencyAmount)
  }, [currencyAmount, price])
}
