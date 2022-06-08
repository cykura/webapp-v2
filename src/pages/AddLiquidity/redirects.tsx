import { useActiveWeb3ReactSol } from 'hooks/web3'
import { Redirect, RouteComponentProps } from 'react-router-dom'
import { SOLCYS_LOCAL } from '../../constants/tokens'
import AddLiquidity from './indexnew'

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
    currencyIdA === 'CYS' || (chainId !== undefined && currencyIdA === SOLCYS_LOCAL.address.toString())
  const isETHOrWETHB =
    currencyIdB === 'CYS' || (chainId !== undefined && currencyIdB === SOLCYS_LOCAL.address.toString())

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
