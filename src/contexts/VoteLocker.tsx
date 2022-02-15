import * as anchor from '@project-serum/anchor'
import { ConnectedWallet, useConnectedWallet, useSolana } from '@saberhq/use-solana'
import { createContext, useContext } from 'react'
import { STAKING_PROGRAM } from '../constants/addresses'
import idl from '../constants/rewards.json'

interface IProps {
  children: JSX.Element[] | JSX.Element
}

export const VoteLocker = createContext({} as any)

export default function useStaking() {
  const values = useContext(VoteLocker)
  return {
    ...values,
  }
}

export function VoteLockerProvider(props: IProps) {
  const { connected: isConnected, connection } = useSolana()
  const wallet = useConnectedWallet() as ConnectedWallet

  const provider = new anchor.Provider(connection, wallet, {
    skipPreflight: false,
  })
  const voteLockerProgram = new anchor.Program(idl as anchor.Idl, STAKING_PROGRAM, provider)

  const value = {
    voteLockerProgram,
  }

  return <VoteLocker.Provider value={value}>{props.children}</VoteLocker.Provider>
}
