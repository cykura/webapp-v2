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

if (!!window.ethereum) {
  window.ethereum.autoRefreshOnNetworkChange = false
}

const DEFAULT_NETWORK: any = process.env.REACT_APP_DEFAULT_NETWORK ?? 'mainnet-beta'

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

ReactDOM.render(
  <StrictMode>
    <Provider store={store}>
      <WalletKitProvider
        app={{ name: 'cykura' }}
        defaultNetwork={DEFAULT_NETWORK}
        networkConfigs={{
          'mainnet-beta': {
            name: 'Custom RPC',
            endpoint: 'https://dawn-red-log.solana-mainnet.quiknode.pro/ff88020a7deb8e7d855ad7c5125f489ef1e9db71/',
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
        <HashRouter>
          <Updaters />
          <ThemeProvider>
            <SnackbarProvider autoHideDuration={1500}>
              <ThemedGlobalStyle />
              <App />
            </SnackbarProvider>
          </ThemeProvider>
        </HashRouter>
      </WalletKitProvider>
    </Provider>
  </StrictMode>,
  document.getElementById('root')
)

serviceWorkerRegistration.unregister()
