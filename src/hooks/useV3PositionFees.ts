import { useEffect, useState } from 'react'
import { CyclosCore, IDL, Pool, u32ToSeed } from '@cykura/sdk'
import { CurrencyAmount, Currency } from '@cykura/sdk-core'
import { useV3PositionFromTokenId } from './useV3Positions'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { TICK_SEED, POOL_SEED } from '../constants/tokens'
import { PROGRAM_ID_STR } from '../constants/addresses'
import { useSolana } from '@saberhq/use-solana'
import { useActiveWeb3ReactSol } from './web3'
import * as anchor from '@project-serum/anchor'
import { useToken } from './Tokens'
import { BN } from '@project-serum/anchor'

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
    feeGrowthInside0LastX32,
    feeGrowthInside1LastX32,
    tokensOwed0,
    tokensOwed1,
  } = positionDetails || {}

  const token0 = useToken(token0Address)
  const token1 = useToken(token1Address)

  const [claimAmount, setClaimAmount] = useState<
    [CurrencyAmount<Currency>, CurrencyAmount<Currency>] | [undefined, undefined]
  >([undefined, undefined])

  useEffect(() => {
    ;(async () => {
      if (
        !pool ||
        !parsedTokenId ||
        !positionDetails ||
        !tokenId ||
        !token0 ||
        !token1 ||
        feeAmount === undefined ||
        liquidity === undefined ||
        tickLower === undefined ||
        tickUpper === undefined ||
        feeGrowthInside0LastX32 === undefined ||
        feeGrowthInside1LastX32 === undefined ||
        tokensOwed0 === undefined ||
        tokensOwed1 === undefined
      ) {
        setClaimAmount([undefined, undefined])
        return
      }

      const provider = new anchor.Provider(connection, wallet as Wallet, {
        skipPreflight: false,
      })
      const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)

      const token0Add = new anchor.web3.PublicKey(token0?.address)
      const token1Add = new anchor.web3.PublicKey(token1?.address)

      // fetch tick states
      const [tickLowerState] = await anchor.web3.PublicKey.findProgramAddress(
        [TICK_SEED, token0Add.toBuffer(), token1Add.toBuffer(), u32ToSeed(feeAmount), u32ToSeed(tickLower)],
        cyclosCore.programId
      )
      const [tickUpperState] = await anchor.web3.PublicKey.findProgramAddress(
        [TICK_SEED, token0Add.toBuffer(), token1Add.toBuffer(), u32ToSeed(feeAmount), u32ToSeed(tickUpper)],
        cyclosCore.programId
      )

      const [poolState] = await anchor.web3.PublicKey.findProgramAddress(
        [POOL_SEED, token0Add.toBuffer(), token1Add.toBuffer(), u32ToSeed(feeAmount)],
        cyclosCore.programId
      )

      const { feeGrowthOutside0X32: feeGrowthOutside0X32Lower, feeGrowthOutside1X32: feeGrowthOutside1X32Lower } =
        await cyclosCore.account.tickState.fetch(tickLowerState)
      const { feeGrowthOutside0X32: feeGrowthOutside0X32Upper, feeGrowthOutside1X32: feeGrowthOutside1X32Upper } =
        await cyclosCore.account.tickState.fetch(tickUpperState)
      const { feeGrowthGlobal0X32, feeGrowthGlobal1X32 } = await cyclosCore.account.poolState.fetch(poolState)

      const [feeGrowthBelow0X32, feeGrowthBelow1X32] =
        pool.tickCurrent >= tickLower
          ? [feeGrowthOutside0X32Lower, feeGrowthOutside1X32Lower]
          : [feeGrowthGlobal0X32.sub(feeGrowthOutside0X32Lower), feeGrowthGlobal1X32.sub(feeGrowthOutside1X32Lower)]

      const [feeGrowthAbove0X32, feeGrowthAbove1X32] =
        pool.tickCurrent < tickUpper
          ? [feeGrowthOutside0X32Upper, feeGrowthOutside1X32Upper]
          : [feeGrowthGlobal0X32.sub(feeGrowthOutside0X32Upper), feeGrowthGlobal1X32.sub(feeGrowthOutside1X32Upper)]

      // calculate fee growth inside range
      const feeGrowthInside0X32 = feeGrowthGlobal0X32.sub(feeGrowthBelow0X32).sub(feeGrowthAbove0X32)
      const feeGrowthInside1X32 = feeGrowthGlobal1X32.sub(feeGrowthBelow1X32).sub(feeGrowthAbove1X32)

      const Q32 = new BN(2).shln(31)
      const tokensOwed0Current = tokensOwed0.add(
        feeGrowthInside0X32.sub(feeGrowthInside0LastX32).mul(liquidity).div(Q32)
      )
      const tokensOwed1Current = tokensOwed1.add(
        feeGrowthInside1X32.sub(feeGrowthInside1LastX32).mul(liquidity).div(Q32)
      )

      if (tokensOwed0Current && tokensOwed1Current) {
        setClaimAmount([
          CurrencyAmount.fromRawAmount(token0, tokensOwed0Current.toString()),
          CurrencyAmount.fromRawAmount(token1, tokensOwed1Current.toString()),
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
