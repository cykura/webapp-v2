import { useActiveWeb3ReactSol } from 'hooks/web3'
import { Redirect, RouteComponentProps } from 'react-router-dom'
import { SOLCYS_LOCAL, WETH9_EXTENDED } from '../../constants/tokens'
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
  const isETHOrWETHA = currencyIdA === 'CYS' || (chainId !== undefined && currencyIdA === SOLCYS_LOCAL.address)
  const isETHOrWETHB = currencyIdB === 'CYS' || (chainId !== undefined && currencyIdB === SOLCYS_LOCAL.address)

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
