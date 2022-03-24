import { nanoid } from '@reduxjs/toolkit'
import { useCallback } from 'react'
import { useAppDispatch } from 'state/hooks'
import uriToHttp from 'utils/uriToHttp'
import { fetchTokenList } from '../state/lists/actions'

export interface TokenList {
  readonly name: string
  readonly timestamp: string
  readonly version: Version
  readonly tokens: TokenInfo[]
  readonly keywords?: string[]
  readonly tags?: Tags
  readonly logoURI?: string
}
export interface TokenInfo {
  readonly chainId: number
  readonly address: string
  readonly name: string
  readonly decimals: number
  readonly symbol: string
  readonly logoURI?: string
  readonly tags?: string[]
  readonly extensions?: {
    readonly [key: string]: string | number | boolean | null
  }
}
export interface Version {
  readonly major: number
  readonly minor: number
  readonly patch: number
}
export interface Tags {
  readonly [tagId: string]: {
    readonly name: string
    readonly description: string
  }
}

export function useFetchListCallback(): (listUrl: string, sendDispatch?: boolean) => Promise<TokenList> {
  const dispatch = useAppDispatch()

  // note: prevent dispatch if using for list search or unsupported list
  return useCallback(
    async (listUrl: string, sendDispatch = true) => {
      const requestId = nanoid()
      sendDispatch && dispatch(fetchTokenList.pending({ requestId, url: listUrl }))
      return getTokenList(listUrl)
        .then((tokenList) => {
          sendDispatch && dispatch(fetchTokenList.fulfilled({ url: listUrl, tokenList, requestId }))
          return tokenList
        })
        .catch((error) => {
          console.debug(`Failed to get list at url ${listUrl}`, error)
          sendDispatch && dispatch(fetchTokenList.rejected({ url: listUrl, requestId, errorMessage: error.message }))
          throw error
        })
    },
    [dispatch]
  )
}
async function getTokenList(listUrl: string): Promise<TokenList> {
  const urls = uriToHttp(listUrl)

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const isLast = i === urls.length - 1
    let response
    try {
      response = await fetch(url, { credentials: 'omit' })
    } catch (error) {
      console.debug('Failed to fetch list', listUrl, error)
      if (isLast) throw new Error(`Failed to download list ${listUrl}`)
      continue
    }

    if (!response.ok) {
      if (isLast) throw new Error(`Failed to download list ${listUrl}`)
      continue
    }

    const json = await response.json()

    return json
  }
  throw new Error('Unrecognized list URL protocol.')
}
