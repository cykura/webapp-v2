import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, Token as SplToken } from '@solana/spl-token'
import { useSolana } from '@saberhq/use-solana'

import { Currency, Token, CurrencyAmount } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { useEffect, useMemo, useState } from 'react'
import { UNI, WSOL_LOCAL, WSOL_MAIN } from '../../constants/tokens'
import { useActiveWeb3ReactSol } from '../../hooks/web3'
import { useAllTokens } from '../../hooks/Tokens'

/**
 * Returns a map of the given addresses to their eventually consistent ETH balances.
 */
export function useSOLBalance(uncheckedAddress: string | undefined): {
  [address: string]: CurrencyAmount<Currency> | undefined
} {
  const { chainId, account } = useActiveWeb3ReactSol()

  const { connection, connected } = useSolana()
  const [balance, setBalance] = useState<any>(0)

  useEffect(() => {
    if (!uncheckedAddress) return
    // Native Sol balance
    connection.getBalance(new PublicKey(uncheckedAddress)).then((data) => {
      setBalance(data)
    })
  }, [account, chainId, uncheckedAddress, connected])

  return useMemo(() => {
    return {
      ['So11111111111111111111111111111111111111112']: CurrencyAmount.fromRawAmount(
        WSOL_LOCAL,
        JSBI.BigInt(balance.toString())
      ),
    }
  }, [account, chainId, uncheckedAddress, balance, connected])
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
  const [solBalances, setSolBalances] = useState<{ [key: string]: string | undefined }>({})
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
    if (!address) return

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

        validatedTokens.forEach((token: Token) => {
          if (tokenBalancesMap[token.address]) {
            // set balance of token
            setSolBalances((p) => {
              p[token.address] = tokenBalancesMap[token.address]
              return p
            })
          } else {
            // account doesn't have token then set to 0
            setSolBalances((p) => {
              p[token.address] = '0'
              return p
            })
          }
        })
        const balanceList =
          validatedTokens.length > 0
            ? validatedTokens.reduce<{ [tokenAddress: string]: CurrencyAmount<Token> | undefined }>(
                (memo, token, i) => {
                  const tkAdd: string = token.address
                  const value = solBalances[tkAdd]
                  const amount = JSBI.BigInt(value ?? '')
                  if (amount) {
                    memo[token.address] = CurrencyAmount.fromRawAmount(token, amount)
                  }
                  return memo
                },
                {}
              )
            : {}
        setTokenBalanceList(balanceList)
      })
      .catch((e) => {
        console.log('Something went wrong trying to fetch token balances', e)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [address])
  // console.log(tokenBalanceList)
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
  // const containsETH: boolean = useMemo(() => currencies?.some((currency) => currency?.isNative) ?? false, [currencies])
  // const ethBalance = useETHBalances(containsETH ? [account] : [])
  const solBalance = useSOLBalance(account)

  return useMemo(
    () =>
      currencies?.map((currency) => {
        if (!account || !currency) return undefined
        if (currency.symbol == 'SOL') return solBalance[WSOL_MAIN.address]
        if (currency.isToken) return allTokenBalances[currency.address]
        return undefined
      }) ?? [],
    [account, currencies, solBalance, allTokenBalances]
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
