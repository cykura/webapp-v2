import useFarming from '../../contexts/Farms'
import React, { useCallback, useEffect, useState } from 'react'
import { PoolType } from 'constants/addresses'
import { RowBetween, RowFixed } from 'components/Row'
import Column, { AutoColumn, ColumnCenter } from 'components/Column'
import styled from 'styled-components/macro'
import { DarkCard } from 'components/Card'
import { useSolana } from '@saberhq/use-solana'
import { useWalletKit } from '@gokiprotocol/walletkit'
import { useSnackbar } from 'notistack'
import { ExternalLink, HideExtraSmall, HideSmall, MEDIA_WIDTHS, TYPE } from 'theme'
import Color from 'theme/styled'
import { Loader, RefreshCcw, Settings, ChevronDown } from 'react-feather'
import { ButtonPrimary, ButtonSecondary } from 'components/Button'
import TransactionConfirmationModal, { ConfirmationModalContent } from 'components/TransactionConfirmationModal'
import DoubleCurrencyLogo from 'components/DoubleLogo'
import { Link } from 'react-router-dom'
import { useCurrency } from 'hooks/Tokens'
import Badge from 'components/Badge'
import RangeBadge from 'components/Badge/RangeBadge'
import { Percent } from '@cykura/sdk-core'
import AnimatedDropdown from 'components/AnimatedDropdown'
import FarmListItem from './FarmListItem'
import { LoadingRows } from 'pages/Pool/styleds'

const PageWrapper = styled(AutoColumn)`
  max-width: 940px;
  width: 100%;

  ${({ theme }) => theme.mediaWidth.upToMedium`
    max-width: 800px;
  `};

  ${({ theme }) => theme.mediaWidth.upToSmall`
    max-width: 500px;
  `};
`

const ResponsiveRow = styled(RowBetween)`
  gap: 16px;
  ${({ theme }) => theme.mediaWidth.upToSmall`
    flex-direction: column;
    align-items: flex-start;
    width: 100%:
  `};
`

const PrimaryPositionIdData = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  > * {
    margin-right: 8px;
  }
`

const DataText = styled.div`
  font-weight: 600;
  font-size: 18px;

  ${({ theme }) => theme.mediaWidth.upToSmall`
    font-size: 14px;
  `};
`

const BadgeText = styled.div`
  font-weight: 500;
  font-size: 14px;
  ${({ theme }) => theme.mediaWidth.upToSmall`
    font-size: 12px;
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
const LinkRow = styled(Link)`
  align-items: center;
  border-radius: 20px;
  display: flex;
  cursor: pointer;
  user-select: none;
  justify-content: space-between;
  color: ${({ theme }) => theme.text1};
  margin: 8px 0;
  padding: 16px;
  text-decoration: none;
  font-weight: 500;
  background-color: ${({ theme }) => theme.bg1};

  &:first-of-type {
    margin: 0 0 8px 0;
  }
  &:last-of-type {
    margin: 8px 0 0 0;
  }
  & > div:not(:first-child) {
    text-align: right;
  }
  :hover {
    background-color: ${({ theme }) => theme.bg2};
  }
  @media screen and (min-width: ${MEDIA_WIDTHS.upToSmall}px) {
    flex-direction: row;
  }

  ${({ theme }) => theme.mediaWidth.upToSmall`
    flex-direction: column;
    row-gap: 24px;
  `};
`

const RotatingArrow = styled(ChevronDown)<{ open?: boolean }>`
  transform: ${({ open }) => (open ? 'rotate(180deg)' : 'none')};
  transition: transform 0.1s linear;
`
const DesktopHeader = styled.div`
  padding: 8px;

  @media screen and (min-width: ${MEDIA_WIDTHS.upToSmall}px) {
    align-items: center;
    display: flex;

    display: grid;
    grid-template-columns: 1fr 1fr;
    & > div:last-child {
      text-align: right;
      margin-right: 12px;
    }
  }
`

const StyledDiv = styled.div`
  align-items: center;
  border-radius: 20px;
  display: flex;
  cursor: pointer;
  user-select: none;
  justify-content: space-between;
  color: ${({ theme }) => theme.text1};
  margin: 8px;
  padding: 16px;
  text-decoration: none;
  font-weight: 500;
  background-color: ${({ theme }) => theme.bg1};
`

function FarmList({ farms }: any) {
  const {} = useFarming()

  const [loading, setLoading] = useState(false)

  const [showDetails, setShowDetails] = useState(false)

  const currencyBase = useCurrency('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  const currencyQuote = useCurrency('StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT')

  return (
    <>
      <DesktopHeader> List of Active Farms </DesktopHeader>
      {loading ? (
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
      ) : (
        farms.map((f: any, i: number) => <FarmListItem key={i} />)
      )}
    </>
  )
}

export default FarmList
