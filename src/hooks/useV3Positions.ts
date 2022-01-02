import { useSingleCallResult, useSingleContractMultipleData, Result } from 'state/multicall/hooks'
import { useEffect, useMemo, useState } from 'react'
import { PositionDetails } from 'types/position'
import { useV3NFTPositionManagerContract } from './useContract'
import { BigNumber } from '@ethersproject/bignumber'
import { useActiveWeb3ReactSol } from './web3'
import * as anchor from '@project-serum/anchor'
import idl from '../constants/cyclos-core.json'
import { useSolana } from '@saberhq/use-solana'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { PROGRAM_ID_STR } from 'constants/addresses'
import { TOKEN_PROGRAM_ID, Token as SplToken } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import { POSITION_SEED } from 'constants/tokens'
import PositionList from 'components/PositionList'
import JSBI from 'jsbi'

interface UseV3PositionsResults {
  loading: boolean
  positions: PositionDetails[] | undefined
}

interface UseV3PositionResults {
  loading: boolean
  position: PositionDetails | undefined
}

export function useV3PositionFromTokenId(tokenId: BigNumber | undefined): UseV3PositionResults {
  return {
    loading: true,
    position: {
      nonce: '2',
      tokenId: '2',
      operator: 'null',
      token0: 'token 0',
      token1: 'token 1',
      fee: 10,
      tickLower: 0,
      tickUpper: 10,
      liquidity: JSBI.BigInt(100),
      feeGrowthInside0LastX128: JSBI.BigInt(10),
      feeGrowthInside1LastX128: JSBI.BigInt(20),
      tokensOwed0: JSBI.BigInt(10),
      tokensOwed1: JSBI.BigInt(10),
    },
  }
}

export function useV3Positions(account: string | null | undefined): UseV3PositionsResults {
  const { chainId } = useActiveWeb3ReactSol()
  const { connection, wallet } = useSolana()

  const provider = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: false,
  })
  const cyclosCore = new anchor.Program(idl as anchor.Idl, PROGRAM_ID_STR, provider)

  const [positionDetails, setpositionDetails] = useState<PositionDetails[] | undefined>(undefined)

  useEffect(() => {
    ;(async () => {
      const { value } = await connection.getParsedTokenAccountsByOwner(
        new PublicKey(account ?? '8AH4pCW88KxSRTzQe3dkEsLCDvjHJJJ5usiPcbkaGA3M'),
        {
          programId: TOKEN_PROGRAM_ID,
        }
      )

      console.log('All tokens')
      value.forEach((v) => {
        console.log(v)
      })

      console.log("NFT's")
      const transformedList = value.filter((v) => v.account.data.parsed.info.tokenAmount.decimals == 0)
      transformedList.forEach(async (tokens) => {
        return tokens.pubkey
      })

      // console.log(JSON.stringify(transformedList, null, 2))

      const positionList = await Promise.all(
        transformedList.map(async (value) => {
          try {
            // console.log(value.pubkey.toString())

            const [tokenizedPositionState, _] = await PublicKey.findProgramAddress(
              [POSITION_SEED, new PublicKey(value.account.data.parsed.info.mint).toBuffer()],
              cyclosCore.programId
            )

            const tokenizedPositionData = await cyclosCore.account.tokenizedPositionState.fetch(tokenizedPositionState)
            const poolState = await cyclosCore.account.poolState.fetch(tokenizedPositionData.poolId)
            console.log(tokenizedPositionData)
            console.log(poolState)

            return {
              nonce: '1',
              tokenId: tokenizedPositionData.mint.toString(),
              operator: 'null',
              token0: poolState.token0.toString(),
              token1: poolState.token1.toString(),
              fee: poolState.fee,
              tickLower: tokenizedPositionData.tickUpper,
              tickUpper: tokenizedPositionData.tickLower,
              liquidity: tokenizedPositionData.liquidity.toNumber(),
              feeGrowthInside0LastX128: tokenizedPositionData.feeGrowthInside0LastX32,
              feeGrowthInside1LastX128: tokenizedPositionData.feeGrowthInside1LastX32,
              tokensOwed0: tokenizedPositionData.tokensOwed0,
              tokensOwed1: tokenizedPositionData.tokensOwed1,
            }
          } catch (e) {
            console.log(value)
            console.log('ERROR ', e)
            return {
              nonce: '1',
              tokenId: 'dummy',
              operator: 'null',
              token0: 'token0',
              token1: 'token1',
              fee: 1,
              tickLower: 0,
              tickUpper: 1,
              liquidity: JSBI.BigInt(10),
              feeGrowthInside0LastX128: JSBI.BigInt(100),
              feeGrowthInside1LastX128: JSBI.BigInt(200),
              tokensOwed0: JSBI.BigInt(10),
              tokensOwed1: JSBI.BigInt(20),
            }
          }
        })
      )
      console.log(positionList)
      setpositionDetails(positionList)
    })()
  }, [chainId, account])

  return {
    loading: false,
    positions: positionDetails,
  }
}
