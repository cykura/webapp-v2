import * as anchor from '@project-serum/anchor'
import { PublicKey, SolanaProvider } from '@saberhq/solana-contrib'
import { ConnectedWallet, useConnectedWallet, useSolana } from '@saberhq/use-solana'
import {
  findEscrowAddress,
  findGovernorAddress,
  findLockerAddress,
  LockerWrapper,
  TribecaSDK,
  VoteEscrow,
} from '@tribecahq/tribeca-sdk'
import { useActiveWeb3ReactSol } from 'hooks/web3'
import { createContext, useContext, useEffect, useState } from 'react'
import { useCurrencyBalance } from 'state/wallet/hooks'
import { formatCurrencyAmount } from 'utils/formatCurrencyAmount'
import { Currency, Token } from '@uniswap/sdk-core'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { getATAAddress, getTokenAccount } from '@saberhq/token-utils'
import usePrevious from 'hooks/usePrevious'

interface IProps {
  children: JSX.Element[] | JSX.Element
}

export const VeLocker = createContext({} as any)

export default function useVeLocker() {
  const values = useContext(VeLocker)
  return {
    ...values,
  }
}

export function VeLockerProvider(props: IProps) {
  const { connected: isConnected, connection } = useSolana()
  const wallet = useConnectedWallet() as ConnectedWallet
  const { account } = useActiveWeb3ReactSol()

  const ONE_DAY = new anchor.BN(24 * 60 * 60)
  const ONE_YEAR = new anchor.BN(365).mul(ONE_DAY)

  const solanaProvider = SolanaProvider.init({
    connection: connection,
    wallet: wallet,
    opts: {},
  })
  const tribecaSdk = TribecaSDK.load({ provider: solanaProvider })
  const [reloadState, setReloadState] = useState(false)
  const [balance, setBalance] = useState<number>()
  const [governorKey, setGovernorKey] = useState<any>()
  const [lockerKey, setLockerKey] = useState<any>()
  const [escrowKey, setEscrowKey] = useState<any>()
  const [votingPower, setVotingPower] = useState<any>()
  const [escrowAmount, setEscrowAmount] = useState<any>()
  const [escrowEndsAt, setEscrowEndsAt] = useState<any>()
  const [escrowLockTime, setEscrowLockTime] = useState<any>()

  useEffect(() => {
    if (!wallet?.publicKey) return
    ;(async () => {
      const [governorKey] = await findGovernorAddress(new PublicKey('Er3mzZioWGtUvLYvgW3RvBCzeJeFFg81iXY4CtLFPsyc'))
      const [lockerKey] = await findLockerAddress(new PublicKey('Er3mzZioWGtUvLYvgW3RvBCzeJeFFg81iXY4CtLFPsyc'))
      const [escrowKey] = await findEscrowAddress(lockerKey, wallet?.publicKey)
      setGovernorKey(governorKey)
      setLockerKey(lockerKey)
      setEscrowKey(escrowKey)
    })()
  }, [wallet])

  useEffect(() => {
    if (!wallet?.publicKey) return
    if (!tribecaSdk || !lockerKey || !governorKey || !escrowKey) return
    try {
      ;(async () => {
        const tokensInfo = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
          programId: TOKEN_PROGRAM_ID,
        })
        const cysInfo = tokensInfo?.value.filter(
          (v) => v.account.data.parsed.info.mint.toString() === 'cxWg5RTK5AiSbBZh7NRg5btsbSrc8ETLXGf7tk3MUez'
        )
        const balanceInfo = cysInfo?.[0].account.data.parsed.info.tokenAmount.uiAmountString
        setBalance(balanceInfo)

        const escrowWrapper = new VoteEscrow(tribecaSdk, lockerKey, governorKey, escrowKey, wallet.publicKey)
        const lockerWrapper = await LockerWrapper.load(tribecaSdk, lockerKey, governorKey)

        const vepow = (await escrowWrapper.calculateVotingPower()).toNumber()
        setVotingPower(+vepow / 1000_000)

        const escData = await lockerWrapper.fetchEscrow(escrowKey)
        console.log('Amount after lockup: ', escData.amount.toString())
        setEscrowAmount(+escData.amount.toString() / 1000_000)
        console.log('Escrow start: ', escData.escrowStartedAt.toString())
        console.log('Escrow End: ', escData.escrowEndsAt.toString())
        setEscrowEndsAt(escData.escrowEndsAt.toString())
        console.log('lockup time: ', escData.escrowEndsAt.sub(escData.escrowStartedAt).toString())
        setEscrowLockTime(escData.escrowEndsAt.sub(escData.escrowStartedAt).toString())
      })()
    } catch (err) {
      console.log(err)
    }
  }, [wallet, reloadState, tribecaSdk, lockerKey, governorKey, escrowKey])

  const lockTokens = async (lockedAmt: number, duration: number, extend = false) => {
    const lockerWrapper = await LockerWrapper.load(tribecaSdk, lockerKey, governorKey)
    const lockTokensTx = await lockerWrapper.lockTokens({
      amount: extend ? new anchor.BN(0) : new anchor.BN(lockedAmt * 1000_000),
      duration: new anchor.BN(duration).mul(ONE_DAY),
    })

    const lockTokenHash = await lockTokensTx.confirm()
    return lockTokenHash
  }

  const withdrawTokens = async () => {
    const lockerWrapper = await LockerWrapper.load(tribecaSdk, lockerKey, governorKey)
    const exitTx = await lockerWrapper.exit({ authority: wallet.publicKey })
    const exitHash = await exitTx.confirm()
    return exitHash
  }

  const value = {
    lockTokens,
    withdrawTokens,
    balance,
    setReloadState,
    votingPower,
    escrowData: {
      escrowAmount,
      escrowEndsAt,
      escrowLockTime,
    },
  }

  return <VeLocker.Provider value={value}>{props.children}</VeLocker.Provider>
}
