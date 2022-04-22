import useFarming from '../../contexts/Farms'
import React, { useCallback, useEffect, useState, HTMLProps } from 'react'
import { PoolType } from 'constants/addresses'
import { RowBetween, RowFixed } from 'components/Row'
import Column, { AutoColumn, ColumnCenter } from 'components/Column'
import styled from 'styled-components/macro'
import { DarkCard } from 'components/Card'
import { useSolana } from '@saberhq/use-solana'
import { useWalletKit } from '@gokiprotocol/walletkit'
import { useSnackbar } from 'notistack'
import { HideExtraSmall, HideSmall, MEDIA_WIDTHS, TYPE } from 'theme'
import Color from 'theme/styled'
import { Loader, RefreshCcw, Settings, ChevronDown, ArrowDownCircle } from 'react-feather'
import { Text } from 'rebass'
import { Box } from 'rebass/styled-components'
import { ButtonPrimary, ButtonSecondary } from 'components/Button'
import TransactionConfirmationModal, { ConfirmationModalContent } from 'components/TransactionConfirmationModal'
import DoubleCurrencyLogo from 'components/DoubleLogo'
import { LightCard } from 'components/Card'
import { Link } from 'react-router-dom'
import { useCurrency } from 'hooks/Tokens'
import Badge from 'components/Badge'
import useTheme from 'hooks/useTheme'
import RangeBadge from 'components/Badge/RangeBadge'
import InfoBadge from 'components/Badge/InfoBadge'
import { CurrencyAmount, Percent } from '@cykura/sdk-core'
import AnimatedDropdown from 'components/AnimatedDropdown'
import { ExternalLink } from 'theme'
import { TruncatedText } from 'components/swap/styleds'
import CurrencyLogo from 'components/CurrencyLogo'
import { formatCurrencyAmount } from 'utils/formatCurrencyAmount'
import NFTRowItem from './NftRowItem'
import { position } from 'styled-system'
import { LoadingRows } from 'pages/Pool/styleds'

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

const TitleText = styled(Text)`
  margin: 5px;
  padding: 0.5rem 0.3rem;
  font-size: 0.7rem;
  font-weight: 500;
`

const NumberText = styled(Text)`
  margin: 5px;
  padding: 0.5rem 0.3rem;
  font-size: 1.8rem;
  font-weight: 700;
`

// const NFTRowItem = styled(Box)`
//   display: flex;
//   justify-content: space-between;
//   border-radius: 12px;
//   width: 100%;
//   padding: 0.5rem;
//   margin: 0.8rem 0;
//   background-color: ${({ theme }) => theme.bg2};
// `

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

const Label = styled(({ end, ...props }) => <TYPE.label {...props} />)<{ end?: boolean }>`
  display: flex;
  font-size: 16px;
  justify-content: ${({ end }) => (end ? 'flex-end' : 'flex-start')};
  align-items: center;
`

const LinkWrapper = styled.div`
  // color: ${({ theme }) => theme.blue1};
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 24px;
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

function FarmListItem({ farm }: any) {
  const {} = useFarming()
  const theme = useTheme()

  const [showDetails, setShowDetails] = useState(false)

  const currencyBase = useCurrency('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  const currencyQuote = useCurrency('StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT')

  const positions = ['something', 'another']
  // const positions: any = []

  const [loading, setLoading] = useState(false)

  const [attemptingTxn, setAttemptingTxn] = useState('')
  const [txnHash, setTxnHash] = useState('')

  const handleDismissConfirmation = useCallback(() => {
    // if there was a tx hash, we want to clear the input
    setAttemptingTxn('')
    setTxnHash('')
  }, [txnHash])

  return (
    <>
      <TransactionConfirmationModal
        isOpen={!!attemptingTxn || !!txnHash}
        onDismiss={handleDismissConfirmation}
        attemptingTxn={!!attemptingTxn}
        hash={txnHash ?? ''}
        content={() => null}
        pendingText={attemptingTxn}
      />
      <AutoColumn gap={'8px'} style={{ width: '100%', marginBottom: '-8px' }}>
        <StyledDiv>
          <AutoColumn gap={'8px'} style={{ width: '100%', marginBottom: '-8px' }}>
            <div onClick={() => setShowDetails(!showDetails)}>
              <RowFixed style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <PrimaryPositionIdData>
                  <DoubleCurrencyLogo currency0={currencyBase} currency1={currencyQuote} size={18} margin />
                  <DataText>
                    &nbsp;{currencyQuote?.symbol}&nbsp;/&nbsp;{currencyBase?.symbol}
                  </DataText>
                  &nbsp;
                  <Badge>
                    <BadgeText>
                      <span>{new Percent(80, 1_000_000).toSignificant()}%</span>
                    </BadgeText>
                  </Badge>
                  <RangeBadge removed={false} inRange={!false} />
                </PrimaryPositionIdData>
                <div>
                  <RotatingArrow open={Boolean(showDetails)} />
                </div>
              </RowFixed>
              <RowFixed>
                <Badge style={{ margin: '0 5px' }}>
                  <TitleText>APR</TitleText>
                  <NumberText>20%</NumberText>
                  <InfoBadge helperText={'Shows the APR of the pool'} />
                </Badge>
                <Badge style={{ margin: '0 5px' }}>
                  <TitleText>TVL</TitleText>
                  <NumberText>1.3M</NumberText>
                  <InfoBadge helperText={'Shows the TVL of the pool'} />
                </Badge>
              </RowFixed>
            </div>

            <RowFixed style={{ width: '100%', flexDirection: 'column', gap: '1.2rem' }}>
              <AnimatedDropdown open={showDetails}>
                {loading ? (
                  <LoadingRows>
                    <div />
                    <div />
                    <div />
                    <div />
                  </LoadingRows>
                ) : positions.length != 0 ? (
                  <>
                    <DesktopHeader> Your positions eligible for Farming </DesktopHeader>
                    {positions.map((p: any, i: number) => (
                      <NFTRowItem key={i} />
                    ))}
                  </>
                ) : (
                  <>
                    <DesktopHeader>None of the positions are eligible under this pool</DesktopHeader>
                  </>
                )}
              </AnimatedDropdown>
            </RowFixed>
          </AutoColumn>
        </StyledDiv>
      </AutoColumn>
    </>
  )
}

export default FarmListItem
