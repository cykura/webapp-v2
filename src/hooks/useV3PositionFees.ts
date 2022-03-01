import { useEffect, useState, useMemo } from 'react'
import { Pool, u32ToSeed } from '@uniswap/v3-sdk'
import { CurrencyAmount, Currency } from '@uniswap/sdk-core'
import { useV3PositionFromTokenId } from './useV3Positions'
import JSBI from 'jsbi'
import idl from '../constants/cyclos-core.json'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { TICK_SEED, POOL_SEED, POSITION_SEED } from '../constants/tokens'
import { PROGRAM_ID_STR } from '../constants/addresses'
import { useSolana } from '@saberhq/use-solana'
import { useActiveWeb3ReactSol } from './web3'
import * as anchor from '@project-serum/anchor'
import { useToken } from './Tokens'

// compute current + counterfactual fees for a v3 position
export function useV3PositionFees(
  pool?: Pool,
  parsedTokenId?: string,
  asWETH = false
): [CurrencyAmount<Currency>, CurrencyAmount<Currency>] | [undefined, undefined] {
  const { position: positionDetails } = useV3PositionFromTokenId(parsedTokenId)

  const { connection, wallet } = useSolana()
  const { account } = useActiveWeb3ReactSol()

  const {
    token0: token0Address,
    token1: token1Address,
    fee: feeAmount,
    liquidity,
    tickLower,
    tickUpper,
    tokenId,
    feeGrowthInside0LastX128,
    feeGrowthInside1LastX128,
    tokensOwed0,
    tokensOwed1,
  } = positionDetails || {}

  const token0 = useToken(token0Address)
  const token1 = useToken(token1Address)
  // console.log(`positionFee called with ${parsedTokenId}`)

  const [claimAmount, setClaimAmount] = useState<
    [CurrencyAmount<Currency>, CurrencyAmount<Currency>] | [undefined, undefined]
  >([undefined, undefined])

  useEffect(() => {
    // console.log('useEffect called')
    ;(async () => {
      if (
        !pool ||
        !parsedTokenId ||
        !feeAmount ||
        !liquidity ||
        !tickLower ||
        !tickUpper ||
        !tokenId ||
        !feeGrowthInside0LastX128 ||
        !feeGrowthInside1LastX128 ||
        !token0 ||
        !token1 ||
        !tokensOwed0 ||
        !tokensOwed1
      ) {
        setClaimAmount([undefined, undefined])
        return
      }

      const provider = new anchor.Provider(connection, wallet as Wallet, {
        skipPreflight: false,
      })
      const cyclosCore = new anchor.Program(idl as anchor.Idl, PROGRAM_ID_STR, provider)

      const current_above_lower = pool.tickCurrent >= tickLower
      const current_below_upper = pool.tickCurrent < tickUpper
      let feeGrowthBelowX: JSBI
      let feeGrowthBelowY: JSBI
      let feeGrowthAboveX: JSBI
      let feeGrowthAboveY: JSBI

      const token0Add = new anchor.web3.PublicKey(token0?.address)
      const token1Add = new anchor.web3.PublicKey(token1?.address)

      const [tickLowerState, tickLowerStateBump] = await anchor.web3.PublicKey.findProgramAddress(
        [TICK_SEED, token0Add.toBuffer(), token1Add.toBuffer(), u32ToSeed(feeAmount), u32ToSeed(tickLower)],
        cyclosCore.programId
      )

      const [tickUpperState, tickUpperStateBump] = await anchor.web3.PublicKey.findProgramAddress(
        [TICK_SEED, token0Add.toBuffer(), token1Add.toBuffer(), u32ToSeed(feeAmount), u32ToSeed(tickUpper)],
        cyclosCore.programId
      )

      const [poolState, poolStateBump] = await anchor.web3.PublicKey.findProgramAddress(
        [POOL_SEED, token0Add.toBuffer(), token1Add.toBuffer(), u32ToSeed(feeAmount)],
        cyclosCore.programId
      )

      // const [factoryState, factoryStateBump] = await anchor.web3.PublicKey.findProgramAddress([], cyclosCore.programId)
      // const [corePositionState, corePositionBump] = await anchor.web3.PublicKey.findProgramAddress(
      //   [
      //     POSITION_SEED,
      //     token0Add.toBuffer(),
      //     token1Add.toBuffer(),
      //     u32ToSeed(feeAmount),
      //     factoryState.toBuffer(),
      //     u32ToSeed(tickLower),
      //     u32ToSeed(tickUpper),
      //   ],
      //   cyclosCore.programId
      // )
      // const corePositionData = await cyclosCore.account.positionState.fetch(corePositionState)
      // let {
      //   feeGrowthInside0LastX32: coreInside0X32,
      //   tokensOwed0: coreTokensOwed0,
      //   tokensOwed1: coreTokensOwed1,
      //   feeGrowthInside1LastX32: coreInside1X32,
      // } = corePositionData

      const tickLowerStateData = await cyclosCore.account.tickState.fetch(tickLowerState)
      const tickUpperStateData = await cyclosCore.account.tickState.fetch(tickUpperState)

      const poolStateData = await cyclosCore.account.poolState.fetch(poolState)

      let { feeGrowthOutside0X32: outside0Lower, feeGrowthOutside1X32: outside1Lower } = tickLowerStateData
      let { feeGrowthOutside0X32: outside0Upper, feeGrowthOutside1X32: outside1Upper } = tickUpperStateData
      let { feeGrowthGlobal0X32, feeGrowthGlobal1X32 } = poolStateData

      outside0Lower = JSBI.BigInt(outside0Lower.toString())
      outside1Lower = JSBI.BigInt(outside1Lower.toString())
      outside0Upper = JSBI.BigInt(outside0Upper.toString())
      outside1Upper = JSBI.BigInt(outside1Upper.toString())
      feeGrowthGlobal0X32 = JSBI.BigInt(feeGrowthGlobal0X32.toString())
      feeGrowthGlobal1X32 = JSBI.BigInt(feeGrowthGlobal1X32.toString())
      // coreInside0X32 = JSBI.BigInt(coreInside0X32.toString())
      // coreInside1X32 = JSBI.BigInt(coreInside1X32.toString())
      // coreTokensOwed0 = JSBI.BigInt(coreTokensOwed0.toString())
      // coreTokensOwed1 = JSBI.BigInt(coreTokensOwed1.toString())

      const feeGrowthInside0LastX32 = JSBI.BigInt(feeGrowthInside0LastX128.toString())
      const feeGrowthInside1LastX32 = JSBI.BigInt(feeGrowthInside1LastX128.toString())
      const posLiquidity = JSBI.BigInt(liquidity.toString())
      const posTokensOwed0 = JSBI.BigInt(tokensOwed0.toString())
      const posTokensOwed1 = JSBI.BigInt(tokensOwed1.toString())

      // calculate fee growth below
      if (current_above_lower) {
        feeGrowthBelowX = outside0Lower
        feeGrowthBelowY = outside1Lower
      } else {
        feeGrowthBelowX = JSBI.subtract(feeGrowthGlobal0X32, outside0Lower)
        feeGrowthBelowY = JSBI.subtract(feeGrowthGlobal1X32, outside1Lower)
      }

      // calculate fee growth above
      if (current_below_upper) {
        feeGrowthAboveX = outside0Upper
        feeGrowthAboveY = outside1Upper
      } else {
        feeGrowthAboveX = JSBI.subtract(feeGrowthGlobal0X32, outside0Upper)
        feeGrowthAboveY = JSBI.subtract(feeGrowthGlobal1X32, outside1Upper)
      }

      // calculate fee growth inside
      let feeGrowthInsideX = JSBI.subtract(JSBI.subtract(feeGrowthGlobal0X32, feeGrowthBelowX), feeGrowthAboveX)
      let feeGrowthInsideY = JSBI.subtract(JSBI.subtract(feeGrowthGlobal1X32, feeGrowthBelowY), feeGrowthAboveY)

      const ZERO = JSBI.BigInt(0)
      const NEG_ONE = JSBI.multiply(JSBI.BigInt(1), JSBI.BigInt(-1))
      const ONE = JSBI.BigInt(1)
      const Q64MAX = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(64))
      const DENO = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(32))

      if (JSBI.lessThan(feeGrowthInsideX, ZERO)) {
        feeGrowthInsideX = JSBI.add(JSBI.subtract(Q64MAX, JSBI.multiply(feeGrowthInsideX, NEG_ONE)), ONE)
      }
      if (JSBI.lessThan(feeGrowthInsideY, ZERO)) {
        feeGrowthInsideY = JSBI.add(JSBI.subtract(Q64MAX, JSBI.multiply(feeGrowthInsideY, NEG_ONE)), ONE)
      }

      let tokensOwedX: JSBI
      let tokensOwedY: JSBI

      if (JSBI.lessThan(feeGrowthInsideX, feeGrowthInside0LastX32)) {
        tokensOwedX = JSBI.divide(
          JSBI.add(JSBI.multiply(posLiquidity, feeGrowthInsideX), JSBI.subtract(Q64MAX, feeGrowthInside0LastX32)),
          DENO
        )
      } else {
        tokensOwedX = JSBI.divide(
          JSBI.add(JSBI.multiply(posLiquidity, feeGrowthInsideX), feeGrowthInside0LastX32),
          DENO
        )
      }

      if (JSBI.lessThan(feeGrowthInsideY, feeGrowthInside1LastX32)) {
        tokensOwedY = JSBI.divide(
          JSBI.add(JSBI.multiply(posLiquidity, feeGrowthInsideY), JSBI.subtract(Q64MAX, feeGrowthInside1LastX32)),
          DENO
        )
      } else {
        tokensOwedY = JSBI.divide(
          JSBI.add(JSBI.multiply(posLiquidity, feeGrowthInsideY), feeGrowthInside1LastX32),
          DENO
        )
      }

      const tokensOwedXTotal = JSBI.add(tokensOwedX, posTokensOwed0)
      const tokensOwedYTotal = JSBI.add(tokensOwedY, posTokensOwed1)

      const [feeValue0, feeValue1] =
        tokensOwedXTotal && tokensOwedYTotal ? [tokensOwedXTotal, tokensOwedYTotal] : [undefined, undefined]

      if (feeValue0 && feeValue1) {
        setClaimAmount([
          CurrencyAmount.fromRawAmount(token0, feeValue0.toString()),
          CurrencyAmount.fromRawAmount(token1, feeValue1.toString()),
        ])
      }
    })()
  }, [account, pool, parsedTokenId])

  if (!pool || !parsedTokenId || !account) {
    return [undefined, undefined]
  } else {
    return claimAmount
  }
}
