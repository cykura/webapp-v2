import 'inter-ui'
import '@reach/dialog/styles.css'
import { WalletKitProvider } from '@gokiprotocol/walletkit'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import App from './pages/App'
import store from './state'
import * as serviceWorkerRegistration from './serviceWorkerRegistration'
import ApplicationUpdater from './state/application/updater'
import MulticallUpdater from './state/multicall/updater'
import LogsUpdater from './state/logs/updater'
import TransactionUpdater from './state/transactions/updater'
import UserUpdater from './state/user/updater'
import ThemeProvider, { ThemedGlobalStyle } from './theme'
import { SnackbarProvider } from 'notistack'
import GradientUpdater from './theme/BgGradient'
import { useSolana } from '@saberhq/use-solana'
import { JupiterProvider } from "@jup-ag/react-hook"

if (!!window.ethereum) {
  window.ethereum.autoRefreshOnNetworkChange = false
}

function Updaters() {
  return (
    <>
      <UserUpdater />
      <ApplicationUpdater />
      <TransactionUpdater />
      <MulticallUpdater />
      <LogsUpdater />
      <GradientUpdater />
    </>
  )
}

const JupiterWrapper: React.FC = ({ children }) => {
  const { connection, wallet } = useSolana()
  return (
    <JupiterProvider
      cluster="mainnet-beta"
      connection={connection}
      userPublicKey={wallet?.publicKey || undefined}
      routeCacheDuration={0}
    >
      {children}
    </JupiterProvider>
  )
}

ReactDOM.render(
  <StrictMode>
    <Provider store={store}>
      <WalletKitProvider
        app={{ name: 'Cykura' }}
        defaultNetwork="mainnet-beta"
        networkConfigs={{
          'mainnet-beta': {
            name: 'Custom RPC',
            endpoint: 'https://dawn-red-log.solana-mainnet.quiknode.pro/1e8643e077f6e07d76170b75e41b21a7ea769e04/',
          },
          devnet: {
            name: 'devnet',
            endpoint: 'https://api.devnet.solana.com',
          },
        }}
        commitment="processed"
        onConnect={() => {
          console.log('Connected')
        }}
        onDisconnect={() => {
          console.log('Disconnected')
        }}
        onError={() => {
          console.log('Error')
        }}
      >
        <JupiterWrapper>
          <HashRouter>
            <Updaters />
            <ThemeProvider>
              <SnackbarProvider autoHideDuration={1500}>
                <ThemedGlobalStyle />
                <App />
              </SnackbarProvider>
            </ThemeProvider>
          </HashRouter>
        </JupiterWrapper>
      </WalletKitProvider>
    </Provider>
  </StrictMode>,
  document.getElementById('root')
)

serviceWorkerRegistration.unregister()
