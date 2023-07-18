import { useWalletKit } from '@gokiprotocol/walletkit'
import { useSolana } from '@saberhq/use-solana'
import { ButtonGray, ButtonPrimary } from 'components/Button'
import { AutoColumn } from 'components/Column'
import { FlyoutAlignment, NewMenu, PopupMenu } from 'components/Menu'
import { SwapPoolTabs } from 'components/NavigationTabs'
import PositionList from 'components/PositionList'
import { RowBetween, RowFixed } from 'components/Row'
import { SwitchLocaleLink } from 'components/SwitchLocaleLink'
import Toggle from 'components/Toggle'
import { useV3Positions } from 'hooks/useV3Positions'
import { useActiveWeb3ReactSol } from 'hooks/web3'
import { useContext } from 'react'
import { BookOpen, Inbox, PlusCircle, MoreVertical } from 'react-feather'
import { Link } from 'react-router-dom'
import { useUserHideClosedPositions } from 'state/user/hooks'
import styled, { ThemeContext } from 'styled-components/macro'
import { HideSmall, TYPE } from 'theme'
import { PositionDetails } from 'types/position'
import { LoadingRows } from './styleds'
import JSBI from 'jsbi'

const PageWrapper = styled(AutoColumn)`
  max-width: 870px;
  width: 100%;

  ${({ theme }) => theme.mediaWidth.upToMedium`
    max-width: 800px;
  `};

  ${({ theme }) => theme.mediaWidth.upToSmall`
    max-width: 500px;
  `};
`
const TitleRow = styled(RowBetween)`
  color: ${({ theme }) => theme.text2};
  ${({ theme }) => theme.mediaWidth.upToSmall`
    flex-wrap: wrap;
    gap: 12px;
    width: 100%;
    flex-direction: column-reverse;
  `};
`
const ButtonRow = styled(RowFixed)`
  & > *:not(:last-child) {
    margin-right: 8px;
  }
  ${({ theme }) => theme.mediaWidth.upToSmall`
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
  `};
`
const Menu = styled(PopupMenu)`
  margin-left: 0;
`
const MenuItem = styled.div`
  align-items: center;
  display: flex;
  justify-content: flex-start;
`
const MoreOptionsButton = styled(ButtonGray)`
  border-radius: 12px;
  flex: 1 1 auto;
  padding: 8px 10px;
`
const NoLiquidity = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin: auto;
  max-width: 300px;
  min-height: 25vh;
`
const ResponsiveButtonPrimary = styled(ButtonPrimary)`
  border-radius: 12px;
  padding: 6px 8px;
  width: fit-content;
  color: ${({ theme }) => theme.text5};
  ${({ theme }) => theme.mediaWidth.upToSmall`
    flex: 1 1 auto;
    width: 49%;
  `};
`

const MainContentWrapper = styled.main`
  background-color: ${({ theme }) => theme.bg0};
  min-height: 50vh;
  padding: 8px;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
`

const ShowInactiveToggle = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6em;
  width: max-content;
  padding: 8px;
`

export default function Pool() {
  const { account } = useActiveWeb3ReactSol()
  const { connect } = useWalletKit()
  const { disconnect, connected, walletProviderInfo } = useSolana()

  const theme = useContext(ThemeContext)
  const [userHideClosedPositions, setUserHideClosedPositions] = useUserHideClosedPositions()

  const { positions, loading: positionsLoading } = useV3Positions(account)

  const [openPositions, closedPositions] = positions?.reduce<[PositionDetails[], PositionDetails[]]>(
    (acc, p) => {
      acc[JSBI.EQ(p?.liquidity, 0) ? 1 : 0].push(p)
      return acc
    },
    [[], []]
  ) ?? [[], []]

  const filteredPositions = [...openPositions, ...(userHideClosedPositions ? [] : closedPositions)]

  const menuItems = [
    {
      content: (
        <MenuItem>
          <PlusCircle size={16} style={{ marginRight: '12px' }} />
          <span>Create a pool</span>
        </MenuItem>
      ),
      link: '/add/SOL',
      external: false,
    },
    {
      content: (
        <MenuItem>
          <BookOpen size={16} style={{ marginRight: '12px' }} />
          <span>Learn</span>
        </MenuItem>
      ),
      link: 'https://cykura.io/',
      external: true,
    },
  ]

  return (
    <>
      <PageWrapper>
        <SwapPoolTabs active={'pool'} />
        <AutoColumn gap="lg" justify="center">
          <AutoColumn gap="lg" style={{ width: '100%' }}>
            <TitleRow style={{ padding: '0 0.5em', marginTop: '1rem' }}>
              <HideSmall>
                <TYPE.largeHeader>
                  <span>Pools Overview</span>
                </TYPE.largeHeader>
              </HideSmall>
              <ButtonRow>
                <ResponsiveButtonPrimary id="join-pool-button" disabled={true}>
                  + <span>New Position</span>
                </ResponsiveButtonPrimary>
                <Menu
                  content={
                    <ShowInactiveToggle>
                      <TYPE.small>
                        <span>Closed positions</span>
                      </TYPE.small>
                      <Toggle
                        id="small"
                        isActive={!userHideClosedPositions}
                        toggle={() => setUserHideClosedPositions(!userHideClosedPositions)}
                        checked={<span>Show</span>}
                        unchecked={<span>Hide</span>}
                      />
                    </ShowInactiveToggle>
                  }
                  flyoutAlignment={FlyoutAlignment.RIGHT}
                  ToggleUI={(props: any) => (
                    <MoreOptionsButton {...props}>
                      <TYPE.body style={{ alignItems: 'center', display: 'flex' }}>
                        <MoreVertical size={15} />
                      </TYPE.body>
                    </MoreOptionsButton>
                  )}
                />
              </ButtonRow>
            </TitleRow>

            <MainContentWrapper>
              {positionsLoading ? (
                <LoadingRows>
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                </LoadingRows>
              ) : filteredPositions && filteredPositions.length > 0 ? (
                <PositionList positions={filteredPositions} />
              ) : (
                <NoLiquidity>
                  <TYPE.mediumHeader color={theme.text3} textAlign="center">
                    <Inbox size={48} strokeWidth={1} style={{ marginBottom: '.5rem' }} />
                    <div>
                      <span>Your liquidity positions will appear here.</span>
                    </div>
                  </TYPE.mediumHeader>
                  {!connected && (
                    <ButtonPrimary style={{ marginTop: '2em', padding: '8px 16px' }} onClick={connect}>
                      <span>Connect a wallet</span>
                    </ButtonPrimary>
                  )}
                </NoLiquidity>
              )}
            </MainContentWrapper>
          </AutoColumn>
        </AutoColumn>
      </PageWrapper>
      <SwitchLocaleLink />
    </>
  )
}
