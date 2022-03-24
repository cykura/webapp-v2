import { Currency, Token } from '@cykura/sdk-core'
import { useEffect, useMemo, useState } from 'react'
import { useUserAddedTokens } from '../state/user/hooks'
import { useActiveWeb3ReactSol } from './web3'
import { createTokenFilterFunction } from '../components/SearchModal/filtering'
import { useSolana } from '@saberhq/use-solana'
import { WrappedTokenInfo } from 'state/lists/wrappedTokenInfo'
import { TokenList } from '@uniswap/token-lists'
import { NATIVE_MINT } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import { TokenAddressMap, useCombinedActiveList } from 'state/lists/hooks'
import { WSOL_LOCAL } from 'constants/tokens'

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
              tokenMap[token.address.toString()] = token
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
  // TODO: Refine it a litte more? Does it work?
  // Tokens show up for mainnet
  // TODO: for localnet works with cykura-protocol scripts (tokens are hardcoded)
  // TODO: replicate this for devnet
  const allTokens = useCombinedActiveList()
  return useTokensFromMap(allTokens, true)
}

export function useIsTokenActive(token: Token | undefined | null): boolean {
  const activeTokens = useAllTokens()

  if (!activeTokens || !token) {
    return false
  }

  return !!activeTokens[token.address.toString()]
}

// Check if currency is included in custom list from user storage
export function useIsUserAddedToken(currency: Currency | undefined | null): boolean {
  const userAddedTokens = useUserAddedTokens()

  if (!currency) {
    return false
  }

  return !!userAddedTokens.find((token) => currency.equals(token))
}

// undefined if invalid or does not exist
// null if loading
// otherwise returns the token
export function useToken(tokenAddress?: string): Token | undefined {
  const { chainId } = useActiveWeb3ReactSol()
  const tokens = useAllTokens()
  // console.log(tokenAddress)
  const tokenAdd = tokenAddress == NATIVE_MINT.toString() ? WSOL_LOCAL.address : tokenAddress
  const token: Token | undefined | any = tokenAdd ? tokens[tokenAdd.toString()] : undefined

  return useMemo(() => {
    if (!chainId || !tokenAddress || !token) return undefined

    const tokenName = token.name
    const symbol = token.symbol
    const decimals = token.decimals

    if (decimals) {
      return new Token(chainId, new PublicKey(tokenAddress), decimals, symbol ?? 'XXX', tokenName ?? 'UNKNOW TOKEN')
    }
    return undefined
  }, [chainId, tokenAddress])
}

export function useSearchInactiveTokenLists(search: string | undefined, minResults = 10): WrappedTokenInfo[] {
  const { network } = useSolana()
  const { chainId } = useActiveWeb3ReactSol()

  const [allTokens, setAllTokens] = useState<TokenList>()

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json')
      .then((r) => r.json())
      .then((data) => setAllTokens(data))
  }, [network])

  const activeTokens = useAllTokens()
  return useMemo(() => {
    if (!search || search.trim().length === 0 || !allTokens) return []
    const tokenFilter = createTokenFilterFunction(search)
    const result: WrappedTokenInfo[] = []
    const addressSet: { [address: string]: true } = {}

    for (const tokenInfo of allTokens.tokens) {
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
  }, [activeTokens, chainId, minResults, search, allTokens])
}

export function useCurrency(currencyId: string | undefined): Currency | undefined {
  const token = useToken(currencyId)
  return token
}
