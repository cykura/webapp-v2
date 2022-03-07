import { Token, CurrencyAmount } from '@cykura/sdk-core'
import { useMemo } from 'react'
import { useSingleCallResult } from '../state/multicall/hooks'
import { useTokenContract } from './useContract'

export function useTokenAllowance(token?: Token, owner?: string, spender?: string): CurrencyAmount<Token> | undefined {
  // const contract = useTokenContract(token?.address, false)

  // const inputs = useMemo(() => [owner, spender], [owner, spender])
  // const allowance = useSingleCallResult(contract, 'allowance', inputs).result

  // return useMemo(
  //   () => (token && allowance ? CurrencyAmount.fromRawAmount(token, allowance.toString()) : undefined),
  //   [token, allowance]
  // )

  // used in useApproveCallback which is not used now,

  return undefined
}
