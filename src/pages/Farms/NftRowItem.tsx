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

const NFTRow = styled(Box)`
  display: flex;
  justify-content: space-between;
  border-radius: 12px;
  width: 100%;
  padding: 0.5rem;
  margin: 0.8rem 0;
  background-color: ${({ theme }) => theme.bg2};
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

function NFTRowItem({ farm }: any) {
  const {} = useFarming()
  const theme = useTheme()

  const [showDetails, setShowDetails] = useState(false)

  const currencyBase = useCurrency('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  const currencyQuote = useCurrency('StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT')

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
      <NFTRow>
        <PrimaryPositionIdData>
          <LinkWrapper>
            <DataText>NFT ID</DataText>
            <TruncatedText>BWHst3N5otdu6DAVqqZkGc5aiuZh4iBuANfXE1a9pvrA</TruncatedText>
            <ExternalLink
              id="view-nft"
              href="https://solscan.io/token/BWHst3N5otdu6DAVqqZkGc5aiuZh4iBuANfXE1a9pvrA"
              target="_blank"
            >
              <TYPE.link fontSize={16}>
                <span>View NFT</span>
                <span>↗</span>
              </TYPE.link>
            </ExternalLink>
          </LinkWrapper>
          &nbsp;
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <DataText>TVL</DataText>
            <NumberText>25$$</NumberText>
          </div>
          <div>
            <ResponsiveButtonPrimary
              id="stake-button"
              onClick={() => {
                console.log('stake')
                setAttemptingTxn('Staking Position')
              }}
            >
              Stake
            </ResponsiveButtonPrimary>{' '}
          </div>
          <DarkCard>
            <AutoColumn gap="md" style={{ width: '100%' }}>
              <AutoColumn gap="md">
                <RowBetween style={{ alignItems: 'flex-start' }}>
                  <AutoColumn gap="md">
                    <Label>
                      <span>Rewards</span>
                    </Label>
                  </AutoColumn>

                  <ButtonPrimary
                    width="fit-content"
                    style={{ borderRadius: '12px' }}
                    padding="4px 8px"
                    onClick={() => {
                      console.log('collect fees')
                      setAttemptingTxn('Collecting Reward')
                    }}
                  >
                    <TYPE.main color={theme.black}>
                      <span>Collect</span>
                    </TYPE.main>
                  </ButtonPrimary>
                </RowBetween>
              </AutoColumn>
              <LightCard padding="12px 16px">
                <AutoColumn gap="md">
                  <RowBetween>
                    <RowFixed>
                      <CurrencyLogo currency={currencyBase} size={'20px'} style={{ marginRight: '0.5rem' }} />
                      <TYPE.main>{currencyBase?.symbol}</TYPE.main>
                    </RowFixed>
                    <RowFixed>
                      <TYPE.main>
                        {currencyBase && formatCurrencyAmount(CurrencyAmount.fromRawAmount(currencyBase, 1000), 4)}
                      </TYPE.main>
                    </RowFixed>
                  </RowBetween>
                  <RowBetween>
                    <RowFixed>
                      <CurrencyLogo currency={currencyQuote} size={'20px'} style={{ marginRight: '0.5rem' }} />
                      <TYPE.main>{currencyQuote?.symbol}</TYPE.main>
                    </RowFixed>
                    <RowFixed>
                      <TYPE.main>
                        {currencyQuote && formatCurrencyAmount(CurrencyAmount.fromRawAmount(currencyQuote, 1000), 4)}
                      </TYPE.main>
                    </RowFixed>
                  </RowBetween>
                </AutoColumn>
              </LightCard>
            </AutoColumn>
          </DarkCard>
        </PrimaryPositionIdData>
      </NFTRow>
    </>
  )
}

export default NFTRowItem
