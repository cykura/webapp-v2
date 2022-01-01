import 'inter-ui'
import '@reach/dialog/styles.css'
import { WalletKitProvider } from '@gokiprotocol/walletkit'
import { StrictMode } from 'react'
import { isMobile } from 'react-device-detect'
import ReactDOM from 'react-dom'
import ReactGA from 'react-ga'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import { LanguageProvider } from './i18n'
import App from './pages/App'
import store from './state'
import * as serviceWorkerRegistration from './serviceWorkerRegistration'
import ApplicationUpdater from './state/application/updater'
import ListsUpdater from './state/lists/updater'
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

const GOOGLE_ANALYTICS_ID: string | undefined = process.env.REACT_APP_GOOGLE_ANALYTICS_ID
if (typeof GOOGLE_ANALYTICS_ID === 'string') {
  ReactGA.initialize(GOOGLE_ANALYTICS_ID, {
    gaOptions: {
      storage: 'none',
      storeGac: false,
    },
  })
  ReactGA.set({
    anonymizeIp: true,
    customBrowserType: !isMobile
      ? 'desktop'
      : 'web3' in window || 'ethereum' in window
      ? 'mobileWeb3'
      : 'mobileRegular',
  })
} else {
  ReactGA.initialize('test', { testMode: true, debug: true })
}

function Updaters() {
  return (
    <>
      <ListsUpdater />
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
        app={{ name: 'cyclos-swap' }}
        defaultNetwork="localnet"
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
          <LanguageProvider>
            <Updaters />
            <ThemeProvider>
              <SnackbarProvider>
                <ThemedGlobalStyle />
                <App />
              </SnackbarProvider>
            </ThemeProvider>
          </LanguageProvider>
        </HashRouter>
      </WalletKitProvider>
    </Provider>
  </StrictMode>,
  document.getElementById('root')
)

serviceWorkerRegistration.unregister()
