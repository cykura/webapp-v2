import { useActiveWeb3ReactSol } from 'hooks/web3'
import { Redirect, RouteComponentProps } from 'react-router-dom'
import { SOL_LOCAL, WETH9_EXTENDED } from '../../constants/tokens'
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
  const isETHOrWETHA = currencyIdA === 'wSOL' || (chainId !== undefined && currencyIdA === SOL_LOCAL.address)
  const isETHOrWETHB = currencyIdB === 'wSOL' || (chainId !== undefined && currencyIdB === SOL_LOCAL.address)

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
