import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, Token as SplToken } from '@solana/spl-token'
import { useSolana } from '@saberhq/use-solana'

import { Currency, Token, CurrencyAmount, Ether } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { useEffect, useMemo, useState } from 'react'
import { UNI } from '../../constants/tokens'
import { useActiveWeb3ReactSol } from '../../hooks/web3'
import { useAllTokens } from '../../hooks/Tokens'
import { useMulticall2Contract } from '../../hooks/useContract'
import { isAddress } from '../../utils'
import { useSingleContractMultipleData } from '../multicall/hooks'

/**
 * Returns a map of the given addresses to their eventually consistent ETH balances.
 */
export function useETHBalances(uncheckedAddresses?: (string | undefined)[]): {
  [address: string]: CurrencyAmount<Currency> | undefined
} {
  const { chainId } = useActiveWeb3ReactSol()
  const multicallContract = useMulticall2Contract()

  const addresses: string[] = useMemo(
    () =>
      uncheckedAddresses
        ? uncheckedAddresses
            .map(isAddress)
            .filter((a): a is string => a !== false)
            .sort()
        : [],
    [uncheckedAddresses]
  )

  const results = useSingleContractMultipleData(
    multicallContract,
    'getEthBalance',
    addresses.map((address) => [address])
  )

  return useMemo(
    () =>
      addresses.reduce<{ [address: string]: CurrencyAmount<Currency> }>((memo, address, i) => {
        const value = results?.[i]?.result?.[0]
        if (value && chainId)
          memo[address] = CurrencyAmount.fromRawAmount(Ether.onChain(chainId), JSBI.BigInt(value.toString()))
        return memo
      }, {}),
    [addresses, chainId, results]
  )
}

/**
 * Returns a map of token addresses to their eventually consistent token balances for a single account.
 */
export function useTokenBalancesWithLoadingIndicator(
  address?: string,
  tokens?: (Token | undefined)[]
): [{ [tokenAddress: string]: CurrencyAmount<Token> | undefined }, boolean] {
  const { connection, connected } = useSolana()
  const [tokenBalanceList, setTokenBalanceList] = useState<{
    [tokenAddress: string]: CurrencyAmount<Token> | undefined
  }>({})
  const [loading, setLoading] = useState(true)

  function isAddress(value: any): string | false {
    const add = value as string
    if (!add) return false
    if (add.length > 0) {
      return value
    } else {
      return false
    }
  }

  const validatedTokens: Token[] = useMemo(
    () => tokens?.filter((t?: Token): t is Token => isAddress(t?.address) !== false) ?? [],
    [tokens]
  )

  // Store all spl token balances here
  useEffect(() => {
    if (!address || address === '11111111111111111111111111111111') return

    connection
      .getParsedTokenAccountsByOwner(new PublicKey(address), {
        programId: TOKEN_PROGRAM_ID,
      })
      .then((tokensInfo) => {
        const tokenBalancesMap: { [key: string]: string | undefined } = {}
        tokensInfo?.value?.forEach((v) => {
          const add: string = v.account.data.parsed.info.mint.toString() as string
          const amt: string | undefined = v.account.data.parsed.info.tokenAmount.amount
          tokenBalancesMap[add] = amt
        })

        const balanceList: { [key: string]: CurrencyAmount<Token> } = {}
        validatedTokens?.map((token: Token) => {
          const tkAdd: string = token.address
          const value = tokenBalancesMap[tkAdd] ?? ''
          const amount = JSBI.BigInt(value ?? '0')
          if (amount) {
            balanceList[tkAdd] = CurrencyAmount.fromRawAmount(token, amount)
          }
        })
        setTokenBalanceList(balanceList)
      })
      .catch((e) => {
        console.log('Something went wrong trying to fetch token balances', e)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [address])
  return [tokenBalanceList, loading]
}

export function useTokenBalances(
  address?: string,
  tokens?: (Token | undefined)[]
): { [tokenAddress: string]: CurrencyAmount<Token> | undefined } {
  return useTokenBalancesWithLoadingIndicator(address, tokens)[0]
}

// get the balance for a single token/account combo
export function useTokenBalance(account?: string, token?: Token): CurrencyAmount<Token> | undefined {
  const tokenBalances = useTokenBalances(account, [token])
  if (!token) return undefined
  return tokenBalances[token.address]
}

export function useCurrencyBalances(
  account?: string,
  currencies?: (Currency | undefined)[]
): (CurrencyAmount<Currency> | undefined)[] {
  // TODO: Fetches all token balances here, Need to do something more efficient here.
  const allTokens = useAllTokens()
  const arrAllTokens = Object.keys(allTokens).map((a) => allTokens[a])
  const allTokenBalances = useTokenBalances(account, arrAllTokens)

  // const tokenBalances = useTokenBalances(account, tokens)
  const containsETH: boolean = useMemo(() => currencies?.some((currency) => currency?.isNative) ?? false, [currencies])
  const ethBalance = useETHBalances(containsETH ? [account] : [])

  return useMemo(
    () =>
      currencies?.map((currency) => {
        if (!account || !currency) return undefined
        if (currency.isToken) return allTokenBalances[currency.address]
        if (currency.isNative) return ethBalance[account]
        return undefined
      }) ?? [],
    [account, currencies, ethBalance, allTokenBalances]
  )
}

export function useCurrencyBalance(account?: string, currency?: Currency): CurrencyAmount<Currency> | undefined {
  return useCurrencyBalances(account, [currency])[0]
}

// mimics useAllBalances
export function useAllTokenBalances(): { [tokenAddress: string]: CurrencyAmount<Token> | undefined } {
  const { account } = useActiveWeb3ReactSol()
  const allTokens = useAllTokens()
  const allTokensArray = useMemo(() => Object.values(allTokens ?? {}), [allTokens])
  const balances = useTokenBalances(account ?? undefined, allTokensArray)
  return balances ?? {}
}

// get the total owned, unclaimed, and unharvested UNI for account
export function useAggregateUniBalance(): CurrencyAmount<Token> | undefined {
  const { account, chainId } = useActiveWeb3ReactSol()

  const uni = chainId ? UNI[chainId] : undefined

  const uniBalance: CurrencyAmount<Token> | undefined = useTokenBalance(account ?? undefined, uni)
  let uniUnclaimed: CurrencyAmount<Token> | undefined
  let uniUnHarvested: CurrencyAmount<Token> | undefined

  if (!uni) return undefined

  return CurrencyAmount.fromRawAmount(
    uni,
    JSBI.add(
      JSBI.add(uniBalance?.quotient ?? JSBI.BigInt(0), uniUnclaimed?.quotient ?? JSBI.BigInt(0)),
      uniUnHarvested?.quotient ?? JSBI.BigInt(0)
    )
  )
}
