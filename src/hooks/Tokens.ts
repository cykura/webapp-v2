import { parseBytes32String } from '@ethersproject/strings'
import { Currency, Token, WSOL } from '@uniswap/sdk-core'
import { arrayify } from 'ethers/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import { SOLUSDC_LOCAL, SOLUSDT_LOCAL, SOLCYS_LOCAL, SOLUSDC_MAIN, SOLUSDT_MAIN, SOL_LOCAL } from '../constants/tokens'
import { useUserAddedTokens } from '../state/user/hooks'
import { TokenAddressMap, useAllLists, useInactiveListUrls } from './../state/lists/hooks'
import { useActiveWeb3ReactSol } from './web3'
import { useTokenContract } from './useContract'
import { createTokenFilterFunction } from '../components/SearchModal/filtering'
import { SOLUSDC, SOLUSDT } from '../constants/tokens'
import { useSolana } from '@saberhq/use-solana'
import { WrappedTokenInfo } from 'state/lists/wrappedTokenInfo'
import { TokenList } from '@uniswap/token-lists'

// reduce token map into standard address <-> Token mapping, optionally include user added tokens
function useTokensFromMap(tokenMap: TokenAddressMap, includeUserAdded: boolean): { [address: string]: Token } {
  const { chainId } = useActiveWeb3ReactSol()
  const userAddedTokens = useUserAddedTokens()

  return useMemo(() => {
    if (!chainId) return {}

    // reduce to just tokens
    const mapWithoutUrls = Object.keys(tokenMap[chainId] ?? {}).reduce<{ [address: string]: Token }>(
      (newMap, address) => {
        newMap[address] = tokenMap[chainId][address].token
        return newMap
      },
      {}
    )

    if (includeUserAdded) {
      return (
        userAddedTokens
          // reduce into all ALL_TOKENS filtered by the current chain
          .reduce<{ [address: string]: Token }>(
            (tokenMap, token) => {
              tokenMap[token.address] = token
              return tokenMap
            },
            // must make a copy because reduce modifies the map, and we do not
            // want to make a copy in every iteration
            { ...mapWithoutUrls }
          )
      )
    }

    return mapWithoutUrls
  }, [chainId, userAddedTokens, tokenMap, includeUserAdded])
}

export function useAllTokens(): { [address: string]: Token } {
  /// TODO Can switch here and fetch tokens for testing
  ///  Check for network and return corresponding coins
  /// 'devnet' | 'testnet' | 'mainnet-beta' | 'localnet'
  const { network } = useSolana()
  const userAddedTokens = useUserAddedTokens()

  if (network === 'localnet') {
    const map = {
      [SOLUSDC_LOCAL.address]: SOLUSDC_LOCAL,
      [SOLUSDT_LOCAL.address]: SOLUSDT_LOCAL,
      [SOL_LOCAL.address]: SOL_LOCAL,
      [SOLCYS_LOCAL.address]: SOLCYS_LOCAL,
    }
    userAddedTokens.forEach((token) => {
      map[token.address] = token
    })
    return map
  } else if (network === 'mainnet-beta') {
    // return mainnet tokens
    const map = {
      [SOLUSDC_MAIN.address]: SOLUSDC_MAIN,
      [SOLUSDT_MAIN.address]: SOLUSDT_MAIN,
      // [SOLCYS_LOCAL.address]: SOLCYS_LOCAL,
    }
    return map
  } else if (network === 'devnet') {
    // return devnet tokens
    const map = {
      [SOLUSDC_LOCAL.address]: SOLUSDC_LOCAL,
      [SOLUSDT_LOCAL.address]: SOLUSDT_LOCAL,
      // [SOLCYS_LOCAL.address]: SOLCYS_LOCAL,
    }
    return map
  }

  // DEV TOKENS
  const SOL = WSOL[103]
  // const allTokens = useCombinedActiveList()
  // return useTokensFromMap(allTokens, true)
  const map = {
    [SOLUSDC.address]: SOLUSDC,
    [SOLUSDT.address]: SOLUSDT,
    [SOL.address]: SOL,
  }
  return map
}

export function useIsTokenActive(token: Token | undefined | null): boolean {
  const activeTokens = useAllTokens()

  if (!activeTokens || !token) {
    return false
  }

  return !!activeTokens[token.address]
}

// Check if currency is included in custom list from user storage
export function useIsUserAddedToken(currency: Currency | undefined | null): boolean {
  const userAddedTokens = useUserAddedTokens()

  if (!currency) {
    return false
  }

  return !!userAddedTokens.find((token) => currency.equals(token))
}

// parse a name or symbol from a token response
const BYTES32_REGEX = /^0x[a-fA-F0-9]{64}$/

function parseStringOrBytes32(str: string | undefined, bytes32: string | undefined, defaultValue: string): string {
  return str && str.length > 0
    ? str
    : // need to check for proper bytes string and valid terminator
    bytes32 && BYTES32_REGEX.test(bytes32) && arrayify(bytes32)[31] === 0
    ? parseBytes32String(bytes32)
    : defaultValue
}

// undefined if invalid or does not exist
// null if loading
// otherwise returns the token
export function useToken(tokenAddress?: string): Token | undefined | null {
  const { chainId } = useActiveWeb3ReactSol()
  const tokens = useAllTokens()
  // console.log(tokenAddress)
  const token: Token | undefined | any = tokenAddress ? tokens[tokenAddress] : undefined

  return useMemo(() => {
    if (!chainId || !tokenAddress || !token) return undefined

    const tokenName = token.name
    const symbol = token.symbol
    const decimals = token.decimals

    if (decimals) {
      return new Token(chainId, tokenAddress, decimals, symbol ?? 'XXX', tokenName ?? 'UNKNOW TOKEN')
    }
    return undefined
  }, [chainId, tokenAddress])
}

export function useSearchInactiveTokenLists(search: string | undefined, minResults = 10): WrappedTokenInfo[] {
  // console.log(search, ' inside useInactiveTokens')

  const { network } = useSolana()
  const { chainId } = useActiveWeb3ReactSol()

  const [allTokens, setAllTokens] = useState<TokenList>()

  useEffect(() => {
    console.log('useEffect runs')
    fetch('https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json')
      .then((r) => r.json())
      .then((data) => setAllTokens(data))
  }, [network])

  // console.log(allTokens)

  const lists = useAllLists()
  const inactiveUrls = useInactiveListUrls()
  const activeTokens = useAllTokens()
  return useMemo(() => {
    if (!search || search.trim().length === 0 || !allTokens) return []
    const tokenFilter = createTokenFilterFunction(search)
    const result: WrappedTokenInfo[] = []
    const addressSet: { [address: string]: true } = {}
    // for (const url of inactiveUrls) {
    // const list = lists[url].current
    // if (!list) continue
    for (const tokenInfo of allTokens.tokens) {
      // if (tokenInfo.chainId === chainId && tokenFilter(tokenInfo)) {
      if (tokenFilter(tokenInfo)) {
        const wrapped: any = new WrappedTokenInfo(tokenInfo, allTokens)
        if (!(wrapped.address in activeTokens) && !addressSet[wrapped.address]) {
          addressSet[wrapped.address] = true
          result.push(wrapped)
          if (result.length >= minResults) return result
        }
      }
    }
    // }
    // console.log(result)
    return result
  }, [activeTokens, chainId, inactiveUrls, lists, minResults, search, allTokens])
}

export function useCurrency(currencyId: string | undefined): Currency | null | undefined {
  const token = useToken(currencyId)
  return token
}
