import * as anchor from '@project-serum/anchor'
import { createContext, useContext, useEffect, useState } from 'react'
import { useSolana, useWallet } from '@saberhq/use-solana'
import { makeAnchorProvider, makeSaberProvider, newProgramMap } from '@saberhq/anchor-contrib'
import {
  CYKURA_STAKER_ADDRESSES,
  CykuraStakerJSON,
  CykuraStakerSDK,
  CykuraStakerPrograms,
  CYKURA_STAKER_IDLS,
  CykuraStakerIDL,
  CykuraStakerTypes,
  CYKURA_CODERS,
  IncentiveWrapper,
} from '@cykura/staker'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { SolanaAugmentedProvider, SolanaProvider } from '@saberhq/solana-contrib'
import { PublicKey } from '@solana/web3.js'
import { CyclosCore, IDL } from '@cykura/sdk'
import { PROGRAM_ID_STR } from 'constants/addresses'
import { useV3Positions } from 'hooks/useV3Positions'
import { useActiveWeb3ReactSol } from 'hooks/web3'

interface IProps {
  children: JSX.Element[] | JSX.Element
}

export const FarmingContext = createContext({} as any)

export default function useFarming() {
  const values = useContext(FarmingContext)
  return {
    ...values,
  }
}

export function FarmingProvider(props: IProps) {
  const { connected, connection, wallet, providerMut } = useSolana()
  const { account } = useActiveWeb3ReactSol()
  const { positions, loading: positionsLoading } = useV3Positions(account)

  const pro = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: false,
  })
  const stakingProgram = new anchor.Program<CykuraStakerIDL>(
    CykuraStakerJSON,
    CYKURA_STAKER_ADDRESSES.CykuraStaker,
    pro
  )

  const [incentives, setIncentives] = useState<any>([])

  useEffect(() => {
    if (!providerMut || !wallet || !wallet.publicKey) {
      return
    }

    const provider = new SolanaAugmentedProvider(providerMut)

    const programs: CykuraStakerPrograms = newProgramMap<CykuraStakerPrograms>(
      provider,
      CYKURA_STAKER_IDLS,
      CYKURA_STAKER_ADDRESSES
    )

    const cykuraStakerSdk = CykuraStakerSDK.load({ provider })

    async function fetchIncentives() {
      const incentives = await programs.CykuraStaker.account.incentive.all()

      const incentiveWrappers = incentives.map(
        (incentive) => new IncentiveWrapper(cykuraStakerSdk, incentive.publicKey)
      )

      const poolPublicKeys: PublicKey[] = []

      for (const incentive of incentiveWrappers) {
        const data = await incentive.data()

        poolPublicKeys.push(data.pool)

        console.log(JSON.stringify(data, null, 2))

        setIncentives((prevState: any) => [...prevState, data])
      }

      const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, makeAnchorProvider(provider))

      const poolStates = await cyclosCore.account.poolState.fetchMultiple(poolPublicKeys)

      for (const poolState of poolStates) {
        console.log(poolState, null, 2)
      }

      console.log(positions?.map((position) => console.log(position, null, 2)))
    }
    fetchIncentives()
  }, [])

  console.log(incentives)

  // useEffect(() => {}, [])

  const value = {}

  return <FarmingContext.Provider value={value}>{props.children}</FarmingContext.Provider>
}
