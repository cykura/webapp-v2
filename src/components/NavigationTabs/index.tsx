import styled from 'styled-components/macro'
import { darken } from 'polished'

import { NavLink, Link as HistoryLink, useLocation } from 'react-router-dom'
import { Percent } from '@cykura/sdk-core'

import { ArrowLeft } from 'react-feather'
import Row, { RowBetween } from '../Row'
import SettingsTab from '../Settings'
import { ReactNode } from 'react'

import { useAppDispatch } from 'state/hooks'
import { resetMintState as resetMintV3State } from 'state/mint/v3/actions'
import { TYPE } from 'theme'
import useTheme from 'hooks/useTheme'
import { Box } from 'rebass'

const Tabs = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  border-radius: 3rem;
  justify-content: space-evenly;
`

const activeClassName = 'ACTIVE'

const StyledNavLink = styled(NavLink).attrs({
  activeClassName,
})`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  justify-content: center;
  height: 3rem;
  border-radius: 3rem;
  outline: none;
  cursor: pointer;
  text-decoration: none;
  color: ${({ theme }) => theme.text3};
  font-size: 20px;

  &.${activeClassName} {
    border-radius: 12px;
    font-weight: 500;
    color: ${({ theme }) => theme.text1};
  }

  :hover,
  :focus {
    color: ${({ theme }) => darken(0.1, theme.text1)};
  }
`

const ExternalStyledNavLink = styled('a')`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: left;
  border-radius: 3rem;
  outline: none;
  cursor: pointer;
  text-decoration: none;
  color: ${({ theme }) => theme.text2};
  font-size: 1rem;
  width: fit-content;
  font-weight: 500;
  padding: 8px 12px;
  word-break: break-word;

  :hover,
  :focus {
    color: ${({ theme }) => darken(0.1, theme.text1)};
  }
`

const ActiveText = styled.div`
  font-weight: 500;
  font-size: 20px;
`

const StyledArrowLeft = styled(ArrowLeft)`
  color: ${({ theme }) => theme.text1};
`

export function SwapPoolTabs({ active }: { active: 'swap' | 'pool' | 'staking' }) {
  return (
    <Tabs style={{ marginBottom: '20px', display: 'none', padding: '1rem 1rem 0 1rem' }}>
      <StyledNavLink id={`swap-nav-link`} to={'/swap'} isActive={() => active === 'swap'}>
        <span>Swap</span>
      </StyledNavLink>
      <StyledNavLink id={`pool-nav-link`} to={'/pool'} isActive={() => active === 'pool'}>
        <span>Pool</span>
      </StyledNavLink>
      <StyledNavLink id={`stake-nav-link`} to={'/staking'} isActive={() => active === 'staking'}>
        <span>Staking</span>
      </StyledNavLink>
      <ExternalStyledNavLink href={'https://jup.ag/stats'} target={'_blank'}>
        <span>Analytics &#8599;</span>
      </ExternalStyledNavLink>
    </Tabs>
  )
}

export function FindPoolTabs({ origin }: { origin: string }) {
  return (
    <Tabs>
      <RowBetween style={{ padding: '1rem 1rem 0 1rem' }}>
        <HistoryLink to={origin}>
          <StyledArrowLeft />
        </HistoryLink>
        <ActiveText>
          <span>Import V2 Pool</span>
        </ActiveText>
      </RowBetween>
    </Tabs>
  )
}

export function AddRemoveTabs({
  adding,
  creating,
  defaultSlippage,
  positionID,
  children,
}: {
  adding: boolean
  creating: boolean
  defaultSlippage: Percent
  positionID?: string | undefined
  showBackLink?: boolean
  children?: ReactNode | undefined
}) {
  const theme = useTheme()
  // reset states on back
  const dispatch = useAppDispatch()
  const location = useLocation()

  // detect if back should redirect to v3 or v2 pool page
  const poolLink = location.pathname.includes('add/v2')
    ? '/pool/v2'
    : '/pool' + (!!positionID ? `/${positionID.toString()}` : '')

  return (
    <Tabs>
      <RowBetween style={{ padding: '1rem 1rem 0 1rem' }}>
        <HistoryLink
          to={poolLink}
          onClick={() => {
            if (adding) {
              dispatch(resetMintV3State())
            }
          }}
        >
          <StyledArrowLeft stroke={theme.text2} />
        </HistoryLink>
        <TYPE.mediumHeader
          fontWeight={500}
          fontSize={20}
          style={{ flex: '1', margin: 'auto', textAlign: children ? 'start' : 'center' }}
        >
          {creating ? <span>Create a pair</span> : adding ? <span>Add Liquidity</span> : <span>Remove Liquidity</span>}
        </TYPE.mediumHeader>
        <Box style={{ marginRight: '.5rem' }}>{children}</Box>
        <SettingsTab placeholderSlippage={defaultSlippage} />
        <span>&nbsp;</span>
      </RowBetween>
    </Tabs>
  )
}

export function CreateProposalTabs() {
  return (
    <Tabs>
      <Row style={{ padding: '1rem 1rem 0 1rem' }}>
        <HistoryLink to="/vote">
          <StyledArrowLeft />
        </HistoryLink>
        <ActiveText style={{ marginLeft: 'auto', marginRight: 'auto' }}>Create Proposal</ActiveText>
      </Row>
    </Tabs>
  )
}
