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
  liquidity: JSBI
  feeGrowthInside0LastX128: JSBI
  feeGrowthInside1LastX128: JSBI
  tokensOwed0: JSBI
  tokensOwed1: JSBI
}
