import { parseBytes32String } from '@ethersproject/strings'
import { Currency, Token, WSOL } from '@uniswap/sdk-core'
import { arrayify } from 'ethers/lib/utils'
import { useMemo } from 'react'
import { ExtendedEther, SOLUSDC_LOCAL, SOLUSDT_LOCAL, SOL_LOCAL, WETH9_EXTENDED } from '../constants/tokens'
import { useCombinedActiveList } from '../state/lists/hooks'
import { NEVER_RELOAD, useSingleCallResult } from '../state/multicall/hooks'
import { useUserAddedTokens } from '../state/user/hooks'
import { isAddress } from '../utils'
import { TokenAddressMap, useUnsupportedTokenList } from './../state/lists/hooks'

import { useActiveWeb3React, useActiveWeb3ReactSol } from './web3'
import { useBytes32TokenContract, useTokenContract } from './useContract'
import { PublicKey } from '@solana/web3.js'

import { SOLUSDC, SOLUSDT } from '../constants/tokens'
import { useSolana } from '@saberhq/use-solana'

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

  if (network === 'localnet') {
    const map = {
      [SOLUSDC_LOCAL.address]: SOLUSDC_LOCAL,
      [SOLUSDT_LOCAL.address]: SOLUSDT_LOCAL,
      [SOL_LOCAL.address]: SOL_LOCAL,
    }
    return map
  } else if (network === 'mainnet-beta') {
    // return mainnet tokens
  } else if (network === 'devnet') {
    // return devnet tokens
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

export function useUnsupportedTokens(): { [address: string]: Token } {
  const unsupportedTokensMap = useUnsupportedTokenList()
  return useTokensFromMap(unsupportedTokensMap, false)
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

  const address = tokenAddress

  const tokenContract = useTokenContract(address ? address : undefined, false)
  const token: Token | undefined | any = address ? tokens[address] : undefined

  const tokenName = tokenContract.name
  const symbol = tokenContract.symbol
  const decimals = tokenContract.decimals

  return useMemo(() => {
    if (token) return token
    if (!chainId || !address) return undefined
    if (decimals) {
      return new Token(chainId, address, decimals, symbol ?? 'XXX', tokenName ?? 'UNKNOW TOKEN')
    }
    return undefined
  }, [address, chainId, token, tokenName, symbol])
}

export function useCurrency(currencyId: string | undefined): Currency | null | undefined {
  const { chainId } = useActiveWeb3ReactSol()
  const isETH = currencyId?.toUpperCase() === SOL_LOCAL.address
  const token = useToken(isETH ? undefined : currencyId)
  const extendedEther = useMemo(() => (chainId ? SOL_LOCAL : undefined), [chainId])
  const weth = chainId ? SOL_LOCAL : undefined
  if (weth?.address?.toLowerCase() === currencyId?.toLowerCase()) return weth
  return isETH ? extendedEther : token
}
