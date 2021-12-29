import { createContext, useContext } from 'react'
import { useSnackbar } from 'notistack'
import { useWalletKit } from '@gokiprotocol/walletkit'
import { useSolana, useConnectedWallet } from '@saberhq/use-solana'
import * as anchor from '@project-serum/anchor'
import idl from './cyclos_core.json'

interface IProps {
  children: JSX.Element[] | JSX.Element
}

export const CoreContext = createContext({} as any)

const CORE_PROGRAM = new anchor.web3.PublicKey('cysonxupBUVurvLe3Kz9mYrwmNfh43gEP4MgXwHmsUk')

export function CoreProvider(props: IProps) {
  const { enqueueSnackbar } = useSnackbar()
  const { disconnect, connection, walletProviderInfo } = useSolana()
  const wallet = useConnectedWallet()

  const provider = new anchor.Provider(connection, wallet as any, {
    skipPreflight: false,
  })

  const coreProgram = new anchor.Program(idl as anchor.Idl, CORE_PROGRAM, provider)

  const cyclosClient = coreProgram.rpc;

  const value = {
    cyclosClient,
  }
  return <CoreContext.Provider value={value}>{props.children}</CoreContext.Provider>
}

export default function useCoreContext() {
  const values = useContext(CoreContext)
  return {
    ...values,
  }
}
