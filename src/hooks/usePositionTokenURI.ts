import { Position } from '@uniswap/v3-sdk'
import { getPriceOrderingFromPositionForUI } from 'components/PositionListItem'
import { BigNumber } from 'ethers'
import JSBI from 'jsbi'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { NEVER_RELOAD, useSingleCallResult } from '../state/multicall/hooks'
import { useToken } from './Tokens'
import { useV3NFTPositionManagerContract } from './useContract'
import { usePool } from './usePools'
import { useV3PositionFromTokenId } from './useV3Positions'

type TokenId = number | JSBI | BigNumber | string | undefined

const STARTS_WITH = 'data:image/svg+xml;base64,'

type UsePositionTokenURIResult =
  | {
      valid: true
      loading: false
      result: {
        name: string
        description: string
        image: string
      }
    }
  | {
      valid: false
      loading: false
    }
  | {
      valid: true
      loading: true
    }

// Hook
const useAsync = <T, E = string>(asyncFunction: () => Promise<T>, immediate = true) => {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [value, setValue] = useState<T | null>(null)
  const [error, setError] = useState<E | null>(null)
  // The execute function wraps asyncFunction and
  // handles setting state for pending, value, and error.
  // useCallback ensures the below useEffect is not called
  // on every render, but only if asyncFunction changes.
  const execute = useCallback(() => {
    setStatus('pending')
    setValue(null)
    setError(null)
    return asyncFunction()
      .then((response: any) => {
        setValue(response)
        setStatus('success')
      })
      .catch((error: any) => {
        setError(error)
        setStatus('error')
      })
  }, [asyncFunction])
  // Call execute if we want to fire it right away.
  // Otherwise execute can be called later, such as
  // in an onClick handler.
  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [execute, immediate])
  return { execute, status, value, error }
}

export function usePositionTokenURI(tokenId: TokenId | undefined): UsePositionTokenURIResult {
  const { position } = useV3PositionFromTokenId(tokenId as string)

  const { token0, token1, fee, liquidity, tickLower, tickUpper } = position || {}

  const tk0 = useToken(token0)
  const tk1 = useToken(token1)

  const pool = usePool(tk0 ?? undefined, tk1 ?? undefined, fee)
  const below = pool && typeof tickLower === 'number' ? pool.tickCurrent < tickLower : undefined
  const above = pool && typeof tickUpper === 'number' ? pool.tickCurrent >= tickUpper : undefined
  const overRange = above ? -1 : below ? 1 : 0

  const pst = useMemo(() => {
    if (pool && liquidity && typeof tickLower === 'number' && typeof tickUpper === 'number') {
      // console.log(
      //   `POSITION PAGE\nprice is ${pool.sqrtRatioX32.toString()}\ntokenLower is ${tickLower}\ntokenUpper is ${tickUpper}`
      // )
      return new Position({ pool, liquidity: liquidity.toString(), tickLower, tickUpper })
    }
    return undefined
  }, [liquidity, pool, tickLower, tickUpper])
  const { priceLower, priceUpper, base, quote } = getPriceOrderingFromPositionForUI(pst)

  const fetchNFT = useCallback(async () => {
    if (!base || !quote) {
      throw 'no postion'
    }
    const p = {
      mint: tokenId?.toString(),
      qt: quote?.address,
      bt: base?.address,
      qts: quote?.symbol,
      bts: base?.symbol,
      ft: (fee ?? 500) / 10000,
      tl: tickLower,
      tu: tickUpper,
      or: overRange,
    }
    const res = await fetch(
      `https://asia-south1-cyclos-finance.cloudfunctions.net/getSVG?mint=${p.mint}&qt=${p.qt}&bt=${p.bt}&qts=${p.qts}&bts=${p.bts}&ft=${p.ft}&tl=${p.tl}&tu=${p.tu}&or=${p.or}`
    )
    const body = await res.text()
    return body
  }, [tokenId, base, quote, tickLower, tickUpper, fee])

  const { status, value: result, error } = useAsync<string>(fetchNFT)
  const loading = status === 'pending'
  const valid = status === 'success'

  return useMemo(() => {
    if (error || !valid || !tokenId) {
      return {
        valid: false,
        loading: false,
      }
    }
    if (loading) {
      return {
        valid: true,
        loading: true,
      }
    }
    if (!result || !result.startsWith(STARTS_WITH)) {
      return {
        valid: false,
        loading: false,
      }
    } else {
      return {
        valid: true,
        loading: false,
        result: {
          name: 'string',
          description: 'string',
          image: result,
        },
      }
    }
  }, [error, loading, result, tokenId, valid])
}
