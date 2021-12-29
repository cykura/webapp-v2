import { useActiveWeb3React, useActiveWeb3ReactSol } from 'hooks/web3'
import { Redirect, RouteComponentProps } from 'react-router-dom'
import { WETH9_EXTENDED } from '../../constants/tokens'
import AddLiquidity from './index'

export function RedirectDuplicateTokenIds(
  props: RouteComponentProps<{ currencyIdA: string; currencyIdB: string; feeAmount?: string }>
) {
  const {
    match: {
      params: { currencyIdA, currencyIdB },
    },
  } = props

  const { chainId } = useActiveWeb3ReactSol()
  // const chainId = 103;

  // prevent weth + eth
  const isETHOrWETHA =
    currencyIdA === 'SOL' || (chainId !== undefined && currencyIdA === WETH9_EXTENDED[chainId]?.address)
  const isETHOrWETHB =
    currencyIdB === 'SOL' || (chainId !== undefined && currencyIdB === WETH9_EXTENDED[chainId]?.address)

  if (
    currencyIdA &&
    currencyIdB &&
    (currencyIdA.toLowerCase() === currencyIdB.toLowerCase() || (isETHOrWETHA && isETHOrWETHB))
    // (currencyIdA.toLowerCase() === currencyIdB.toLowerCase())
  ) {
    return <Redirect to={`/add/${currencyIdA}`} />
  }
  return <AddLiquidity {...props} />
}
