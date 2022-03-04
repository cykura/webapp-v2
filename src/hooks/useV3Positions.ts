import { useEffect, useState } from 'react'
import { PositionDetails } from 'types/position'
import { useActiveWeb3ReactSol } from './web3'
import * as anchor from '@project-serum/anchor'
import idl from '../constants/cyclos-core.json'
import { useSolana } from '@saberhq/use-solana'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { PROGRAM_ID_STR } from 'constants/addresses'
import { TOKEN_PROGRAM_ID, Token as SplToken } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import { POSITION_SEED } from 'constants/tokens'
import { CyclosCore, IDL } from '@cykura/sdk'

interface UseV3PositionsResults {
  loading: boolean
  positions: PositionDetails[] | undefined
}

interface UseV3PositionResults {
  loading: boolean
  position: PositionDetails | undefined
}

export function useV3PositionFromTokenId(tokenId: string | undefined): UseV3PositionResults {
  // use loading to denote loading state
  // store fetched position state data in useState too.
  const { chainId, account } = useActiveWeb3ReactSol()
  const { connection, wallet } = useSolana()

  const provider = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: false,
  })
  const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)

  const [loading, setLoading] = useState<boolean>(true)
  const [positionDetail, setpositionDetail] = useState<PositionDetails | undefined>(undefined)
  // console.log('FUNC CALL')

  useEffect(() => {
    setLoading(false)
    // console.log('USE MEMO')
    async function fetchPools() {
      if (!tokenId) {
        // console.log('NOT WORK')
        setLoading(false)
        setpositionDetail(undefined)
        return
      }
      let poolState: any
      let tokenizedPositionData: any

      try {
        const [tokenizedPositionState, _] = await PublicKey.findProgramAddress(
          [POSITION_SEED, new PublicKey(tokenId).toBuffer()],
          cyclosCore.programId
        )
        tokenizedPositionData = await cyclosCore.account.tokenizedPositionState.fetch(tokenizedPositionState)
        poolState = await cyclosCore.account.poolState.fetch(tokenizedPositionData.poolId)
      } catch (e) {
        setLoading(false)
        setpositionDetail(undefined)
        console.log(`Something went wrong fetching ${tokenId}`, e)
        return
      }
      setLoading(false)
      setpositionDetail({
        nonce: '1',
        tokenId: tokenizedPositionData.mint.toString(),
        operator: wallet?.publicKey?.toString() ?? 'undefined',
        token0: poolState.token0.toString(),
        token1: poolState.token1.toString(),
        fee: poolState.fee,
        tickLower: tokenizedPositionData.tickLower,
        tickUpper: tokenizedPositionData.tickUpper,
        liquidity: tokenizedPositionData.liquidity,
        feeGrowthInside0LastX32: tokenizedPositionData.feeGrowthInside0LastX32,
        feeGrowthInside1LastX32: tokenizedPositionData.feeGrowthInside1LastX32,
        tokensOwed0: tokenizedPositionData.tokensOwed0,
        tokensOwed1: tokenizedPositionData.tokensOwed1,
      })
    }
    fetchPools()
  }, [chainId, account])

  // console.log('RENDER RUN', positionDetail)

  return {
    loading,
    position: positionDetail,
  }
}

export function useV3Positions(account: string | null | undefined): UseV3PositionsResults {
  const { chainId } = useActiveWeb3ReactSol()
  const { connection, wallet } = useSolana()

  const provider = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: false,
  })
  const cyclosCore = new anchor.Program(idl as anchor.Idl, PROGRAM_ID_STR, provider)

  const [positionDetails, setpositionDetails] = useState<any>(undefined)
  const [loading, setLoading] = useState(false)

  const getAllNfts = async (owner: PublicKey) => {
    const tokens = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    })

    // initial filter - only tokens with 0 decimals & of which 1 is present in the wallet
    return tokens.value
      .filter((t) => {
        const amount = t.account.data.parsed.info.tokenAmount
        return amount.decimals === 0 && amount.uiAmount === 1
      })
      .map((t) => ({
        address: new PublicKey(t.pubkey),
        mint: new PublicKey(t.account.data.parsed.info.mint),
      }))
  }

  useEffect(() => {
    async function fetchNFT() {
      if (!account || account == '11111111111111111111111111111111') return
      setLoading(true)
      // const [mintAuthority, _] = await PublicKey.findProgramAddress([], cyclosCore.programId)

      // console.log("NFT's")
      const nfts = await getAllNfts(new PublicKey(account))

      const positionList = await Promise.all(
        nfts.map(async (nft: any) => {
          try {
            const [tokenizedPositionState, _] = await PublicKey.findProgramAddress(
              [POSITION_SEED, new PublicKey(nft.mint).toBuffer()],
              cyclosCore.programId
            )

            const tokenizedPositionData = await cyclosCore.account.tokenizedPositionState.fetch(tokenizedPositionState)
            const poolState = await cyclosCore.account.poolState.fetch(tokenizedPositionData.poolId)
            // console.log(tokenizedPositionData)
            // console.log(poolState)

            return {
              nonce: '1',
              tokenId: tokenizedPositionData.mint.toString(),
              operator: 'null',
              token0: poolState.token0.toString(),
              token1: poolState.token1.toString(),
              fee: poolState.fee,
              tickLower: tokenizedPositionData.tickLower,
              tickUpper: tokenizedPositionData.tickUpper,
              liquidity: tokenizedPositionData.liquidity.toNumber(),
              feeGrowthInside0LastX128: tokenizedPositionData.feeGrowthInside0LastX32,
              feeGrowthInside1LastX128: tokenizedPositionData.feeGrowthInside1LastX32,
              tokensOwed0: tokenizedPositionData.tokensOwed0,
              tokensOwed1: tokenizedPositionData.tokensOwed1,
            }
          } catch (e) {
            console.warn(e)
          }
          return null
        })
      )
      const posList = positionList.filter((v) => v != null)
      setpositionDetails(posList)
      setLoading(false)
    }
    fetchNFT()
  }, [chainId, account])

  return {
    loading,
    positions: positionDetails,
  }
}
