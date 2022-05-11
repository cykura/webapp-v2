import { Currency, Token } from '@cykura/sdk-core'
import { useEffect, useMemo, useState } from 'react'
import {
  SOLUSDC_LOCAL,
  SOLUSDT_LOCAL,
  SOLCYS_LOCAL,
  SOLUSDC_MAIN,
  SOLUSDT_MAIN,
  CYS_MAIN,
  WSOL_MAIN,
  WSOL_LOCAL,
  UST_MAIN,
  STEP,
  SPACE_FALCON,
  SOLANIUM,
  SOLVENT,
  FXS,
  FCSTEP_VOLT,
} from '../constants/tokens'
import { useUserAddedTokens } from '../state/user/hooks'
import { useActiveWeb3ReactSol } from './web3'
import { createTokenFilterFunction } from '../components/SearchModal/filtering'
import { useSolana } from '@saberhq/use-solana'
import { WrappedTokenInfo } from 'state/lists/wrappedTokenInfo'
import { TokenList } from '@uniswap/token-lists'
import { NATIVE_MINT } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'

export function useAllTokens(): { [address: string]: Token } {
  /// TODO Can switch here and fetch tokens for testing
  ///  Check for network and return corresponding coins
  /// 'devnet' | 'testnet' | 'mainnet-beta' | 'localnet'
  const { network } = useSolana()
  const userAddedTokens = useUserAddedTokens()

  if (network === 'localnet') {
    const map = {
      [SOLUSDC_LOCAL.address.toString()]: SOLUSDC_LOCAL,
      [SOLUSDT_LOCAL.address.toString()]: SOLUSDT_LOCAL,
      [WSOL_LOCAL.address.toString()]: WSOL_LOCAL,
      [SOLCYS_LOCAL.address.toString()]: SOLCYS_LOCAL,
    }
    userAddedTokens.forEach((token) => {
      map[token.address.toString()] = token
    })
    return map
  } else if (network === 'mainnet-beta') {
    // return mainnet tokens
    const map = {
      [WSOL_MAIN.address.toString()]: WSOL_MAIN,
      [SOLUSDC_MAIN.address.toString()]: SOLUSDC_MAIN,
      [SOLUSDT_MAIN.address.toString()]: SOLUSDT_MAIN,
      [CYS_MAIN.address.toString()]: CYS_MAIN,
      [SPACE_FALCON.address.toString()]: SPACE_FALCON,
      [STEP.address.toString()]: STEP,
      [UST_MAIN.address.toString()]: UST_MAIN,
      [SOLANIUM.address.toString()]: SOLANIUM,
      [SOLVENT.address.toString()]: SOLVENT,
      [FCSTEP_VOLT.address.toString()]: FCSTEP_VOLT,
      [FXS.address.toString()]: FXS,
    }
    userAddedTokens.forEach((token) => {
      map[token.address.toString()] = token
    })
    return map
  } else if (network === 'devnet') {
    // return devnet tokens
    const map = {
      [SOLUSDC_LOCAL.address.toString()]: SOLUSDC_LOCAL,
      [SOLUSDT_LOCAL.address.toString()]: SOLUSDT_LOCAL,
      // [SOLCYS_LOCAL.address]: SOLCYS_LOCAL,
    }
    return map
  } else {
    // return localnet by default
    const map = {
      [SOLUSDC_LOCAL.address.toString()]: SOLUSDC_LOCAL,
      [SOLUSDT_LOCAL.address.toString()]: SOLUSDT_LOCAL,
      [WSOL_LOCAL.address.toString()]: WSOL_LOCAL,
      [SOLCYS_LOCAL.address.toString()]: SOLCYS_LOCAL,
    }
    return map
  }
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

    return new Token(chainId, new PublicKey(tokenAddress), decimals, symbol ?? 'XXX', tokenName ?? 'UNKNOW TOKEN')
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
