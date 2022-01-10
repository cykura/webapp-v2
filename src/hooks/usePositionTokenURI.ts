import { BigNumber } from 'ethers'
import JSBI from 'jsbi'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { NEVER_RELOAD, useSingleCallResult } from '../state/multicall/hooks'
import { useV3NFTPositionManagerContract } from './useContract'

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
  const fetchNFT = useCallback(async () => {
    const p = {
      mint: tokenId?.toString(),
      qt: '0xwSol....',
      bt: '0xUSDC....',
      qts: 'wSOL',
      bts: 'USDC',
      pa: 'poolaAddress',
      ft: '0.5%',
      tl: 1.121,
      tu: 2.34,
      ts: 0.1,
      or: 1,
    }
    const res = await fetch(
      `https://asia-south1-cyclos-finance.cloudfunctions.net/getSVG?mint=${p.mint}&qt=${p.qt}&bt=${p.bt}&qts=${p.qts}&bts=${p.bts}&pa=${p.pa}&ft=${p.ft}&tl=${p.tl}&tu=${p.tu}&ts=${p.ts}&or=${p.or}`
    )
    const body = await res.text()
    return body
  }, [tokenId])

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
