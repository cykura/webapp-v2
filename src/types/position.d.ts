import { BigNumber } from '@ethersproject/bignumber'
import JSBI from 'jsbi'

//Needs some modifications to suit types
export interface PositionDetails {
  nonce: string
  tokenId: string
  operator: string
  token0: string
  token1: string
  fee: number
  tickLower: number
  tickUpper: number
  liquidity: BN
  feeGrowthInside0LastX32: BN
  feeGrowthInside1LastX32: BN
  tokensOwed0: BN
  tokensOwed1: BN
}
