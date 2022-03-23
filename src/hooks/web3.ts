import { ReadonlyProvider } from '@saberhq/solana-contrib'
import { useSolana, WalletProviderInfo } from '@saberhq/use-solana'
import { PublicKey } from '@solana/web3.js'
// SPL Version
// Replacing with this causes problems with library and connector stuff
// causes UI to fade out and not be able to input stuff in range. Weird.
export function useActiveWeb3ReactSol(): {
  account: string | undefined
  chainId: number
  librarySol: ReadonlyProvider
  connectorSol: WalletProviderInfo | undefined
} {
  const { wallet, provider, walletProviderInfo, network } = useSolana()
  // console.log(walletProviderInfo, provider)

  const account = wallet?.publicKey?.toString() ?? undefined
  // by default network set to localnet
  let chainId = 104
  switch (network) {
    case 'mainnet-beta': {
      chainId = 101
      break
    }
    case 'testnet': {
      chainId = 102
      break
    }
    case 'localnet': {
      chainId = 104
      break
    }
    default:
      chainId = 101
  }

  return {
    account,
    chainId,
    librarySol: provider,
    connectorSol: walletProviderInfo,
  }
}
