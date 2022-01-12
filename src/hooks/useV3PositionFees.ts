import { useMemo } from 'react'
import { Pool } from '@uniswap/v3-sdk'
import { CurrencyAmount, Currency } from '@uniswap/sdk-core'
import { useV3PositionFromTokenId } from './useV3Positions'
import JSBI from 'jsbi'

// compute current + counterfactual fees for a v3 position
export function useV3PositionFees(
  pool?: Pool,
  tokenId?: string,
  asWETH = false
): [CurrencyAmount<Currency>, CurrencyAmount<Currency>] | [undefined, undefined] {
  const { position } = useV3PositionFromTokenId(tokenId)

  return useMemo(() => {
    if (pool && tokenId && position) {
      return [
        CurrencyAmount.fromRawAmount(pool.token0, JSBI.BigInt(position.tokensOwed0)),
        CurrencyAmount.fromRawAmount(pool.token1, JSBI.BigInt(position.tokensOwed1)),
      ]
    } else {
      return [undefined, undefined]
    }
  }, [tokenId, pool, asWETH])
}
