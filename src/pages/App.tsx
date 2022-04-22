import { FarmingProvider } from 'contexts/Farms'
import { StakingProvider } from 'contexts/Staking'
import ApeModeQueryParamReader from 'hooks/useApeModeQueryParamReader'
import { Route, Switch } from 'react-router-dom'
import styled from 'styled-components/macro'
import GoogleAnalyticsReporter from '../components/analytics/GoogleAnalyticsReporter'
import ErrorBoundary from '../components/ErrorBoundary'
import Header from '../components/Header'
import Popups from '../components/Popups'
import DarkModeQueryParamReader from '../theme/DarkModeQueryParamReader'
import AddLiquidity from './AddLiquidity'
// import AddLiquidity2 from './AddLiquidity/indexnew'
import { RedirectDuplicateTokenIds } from './AddLiquidity/redirects'
import Pool from './Pool'
import { PositionPage } from './Pool/PositionPage'
import RemoveLiquidityV3 from './RemoveLiquidity/V3'
import Staking from './Staking'
import Farms from './Farms'
import Swap from './Swap'
import { RedirectPathToSwapOnly, RedirectToSwap } from './Swap/redirects'

const AppWrapper = styled.div`
  display: flex;
  flex-flow: column;
  align-items: flex-start;
`

const BodyWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 120px 16px 0px 16px;
  align-items: center;
  flex: 1;
  z-index: 0;

  ${({ theme }) => theme.mediaWidth.upToSmall`
  padding: 6rem 16px 16px 16px;
  `};
`

const HeaderWrapper = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  width: 100%;
  justify-content: space-between;
  position: fixed;
  top: 0;
  z-index: 1;
`

const Marginer = styled.div`
  margin-top: 5rem;
`

export default function App() {
  return (
    <ErrorBoundary>
      <Route component={GoogleAnalyticsReporter} />
      <Route component={DarkModeQueryParamReader} />
      <Route component={ApeModeQueryParamReader} />
      <AppWrapper>
        <HeaderWrapper>
          <Header />
        </HeaderWrapper>
        <BodyWrapper>
          <Popups />
          <Switch>
            <Route exact strict path="/send" component={RedirectPathToSwapOnly} />
            <Route exact strict path="/swap/:outputCurrency" component={RedirectToSwap} />
            <Route exact strict path="/swap" component={Swap} />
            <Route exact strict path="/staking">
              <StakingProvider>
                <Staking />
              </StakingProvider>
            </Route>
            <Route exact strict path="/farms">
              <FarmingProvider>
                <Farms />
              </FarmingProvider>
            </Route>
            <Route exact strict path="/pool" component={Pool} />
            <Route exact strict path="/pool/:tokenId" component={PositionPage} />

            <Route
              exact
              strict
              path="/add/:currencyIdA?/:currencyIdB?/:feeAmount?"
              component={RedirectDuplicateTokenIds}
            />

            <Route
              exact
              strict
              path="/increase/:currencyIdA?/:currencyIdB?/:feeAmount?/:tokenId?"
              component={AddLiquidity}
            />

            <Route exact strict path="/remove/:tokenId" component={RemoveLiquidityV3} />

            <Route component={RedirectPathToSwapOnly} />
          </Switch>
          <Marginer />
        </BodyWrapper>
      </AppWrapper>
    </ErrorBoundary>
  )
}
