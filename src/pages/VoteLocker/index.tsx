import { ButtonGray, ButtonPrimary } from 'components/Button'
import Card, { LightCard, OutlineCard } from 'components/Card'
import Column, { AutoColumn, ColumnCenter } from 'components/Column'
import { FlyoutAlignment, PopupMenu } from 'components/Menu'
import Modal from 'components/Modal'
import { SwapPoolTabs } from 'components/NavigationTabs'
import Row, { AutoRow, RowBetween, RowFixed } from 'components/Row'
import Slider from 'components/Slider'
import Toggle from 'components/Toggle'
import { CYS_ICON } from 'constants/tokens'
import useDebouncedChangeHandler from 'hooks/useDebouncedChangeHandler'
import { MaxButton } from 'pages/Pool/styleds'
import { ResponsiveHeaderText, SmallMaxButton } from 'pages/RemoveLiquidity/styled'
import { useCallback, useState } from 'react'
import { MoreVertical } from 'react-feather'
import { Link, useHistory } from 'react-router-dom'
import { Text } from 'rebass'
import styled from 'styled-components/macro'
import { CloseIcon, ExternalLink, HideSmall, StyledInternalLink, TYPE } from 'theme'

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

const ResponsiveButtonPrimary = styled(ButtonPrimary)`
  border-radius: 8px;
  margin: auto;
  margin-top: 1rem;
  padding: 12px;
  width: calc(50% - 1rem);
  color: ${({ theme }) => theme.text5};
  ${({ theme }) => theme.mediaWidth.upToSmall`
    flex: 1 1 auto;
  `};
`

const MainContentWrapper = styled.main<{ flex?: string }>`
  background-color: ${({ theme }) => theme.bg0};
  min-height: 35vh;
  height: 100%;
  padding: 8px;
  border-radius: 10px;
  display: flex;
  flex: ${({ flex }) => flex && `${flex}`};
  flex-direction: column;
`

const BannerCard = styled.main<{ flex?: string }>`
  background-color: ${({ theme }) => theme.bg0};
  min-height: 140px;
  padding: 8px;
  border-radius: 10px;
  display: flex;
  flex: ${({ flex }) => flex && `${flex}`};
  flex-direction: column;
`

const Divider = styled.div`
  width: 100%;
  margin: 1px;
  border-top: 1px solid ${({ theme }) => theme.text5};
`

const GetStartedBtn = styled(ButtonPrimary)`
  border-radius: 8px;
  margin-top: 6px;
  padding: 6px 8px;
  width: fit-content;
  color: ${({ theme }) => theme.text5};
  ${({ theme }) => theme.mediaWidth.upToSmall`
    flex: 1 1 auto;
  `};
`

const IconWrapper = styled.div<{ size?: number }>`
  ${({ theme }) => theme.flexColumnNoWrap};
  display: inline-block;
  align-items: center;
  justify-content: center;
  & > * {
    height: ${({ size }) => (size ? size + 'px' : '1rem')};
    width: ${({ size }) => (size ? size + 'px' : '1rem')};
  }
`

const StyledLink = styled.a`
  text-decoration: none;
  cursor: pointer;
  color: ${({ theme }) => theme.primary1};
  font-weight: 500;

  :hover {
    text-decoration: underline;
  }

  :focus {
    outline: none;
    text-decoration: underline;
  }

  :active {
    text-decoration: none;
  }
`

const StyledInput = styled.input<{ disabled?: boolean; fontSize?: string; align?: string }>`
  color: ${({ disabled, theme }) => (disabled ? theme.bg4 : theme.text1)};
  width: 100%;
  height: 100%;
  font-weight: 400;
  outline: none;
  border: 1px solid ${({ theme }) => theme.text5};
  flex: 1 1 auto;
  background-color: ${({ theme }) => theme.bg1};
  font-size: ${({ fontSize }) => fontSize ?? '1.4rem'};
  text-align: ${({ align }) => align && align};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 6px 10px;
  -webkit-appearance: textfield;
  border-radius: 0.3rem;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'auto')};

  ::-webkit-search-decoration {
    -webkit-appearance: none;
  }

  [type='number'] {
    -moz-appearance: textfield;
  }

  ::-webkit-outer-spin-button,
  ::-webkit-inner-spin-button {
    -webkit-appearance: none;
  }

  ::placeholder {
    color: ${({ theme }) => theme.bg4};
    font-size: 12px;
  }
`

function LockTokensModal({ onDismiss, extend }: any) {
  const [depositAmount, setDepositAmount] = useState(0)
  const [percent, onPercentSelect] = useState(7)
  const [percentForSlider, onPercentSelectForSlider] = useDebouncedChangeHandler(percent, onPercentSelect)

  const formattedDepositAmount = depositAmount
    ? depositAmount?.toLocaleString('fullwide', {
        maximumFractionDigits: 6,
        useGrouping: false,
      })
    : depositAmount?.toString() ?? 0

  return (
    <ColumnCenter>
      <RowBetween style={{ padding: '1rem', paddingBottom: '0.5rem' }}>
        <TYPE.mediumHeader style={{ margin: 'auto' }}>Vote Locker</TYPE.mediumHeader>
        <CloseIcon onClick={onDismiss} />
      </RowBetween>
      <Divider />
      <ColumnCenter style={{ padding: '1rem' }}>
        {extend ? (
          <SmallMaxButton width="100%" style={{ border: '0' }}>
            Extend your lockup to increase the voting power of your current token stake.
          </SmallMaxButton>
        ) : (
          <>
            <RowBetween>
              <TYPE.subHeader color="text2">Deposit Amount</TYPE.subHeader>
              <AutoRow style={{ width: 'max-content' }}>
                <TYPE.subHeader color="text2">Balance:&nbsp;</TYPE.subHeader>
                <StyledLink>
                  <TYPE.link>
                    {(0.0).toFixed(3)} <small>CYS</small>
                  </TYPE.link>
                </StyledLink>
              </AutoRow>
            </RowBetween>
            <RowBetween style={{ gap: 10 }}>
              <LightCard width="50%" padding="0.5rem" $borderRadius="0.3rem">
                <AutoRow gap="5px">
                  <IconWrapper size={24}>
                    <img src={CYS_ICON} />
                  </IconWrapper>
                  <TYPE.main>CYS</TYPE.main>
                </AutoRow>
              </LightCard>
              <StyledInput
                type="number"
                min={0}
                step={0.1}
                value={formattedDepositAmount ?? null}
                onChange={(e) => setDepositAmount(parseFloat(e.target.value))}
              />
            </RowBetween>
          </>
        )}
        <TYPE.subHeader color="text2" width="100%" marginTop={3}>
          Lock Period
        </TYPE.subHeader>
        <ResponsiveHeaderText>
          <span>{percentForSlider} Days</span>
        </ResponsiveHeaderText>
        <Slider value={percentForSlider} onChange={onPercentSelectForSlider} min={7} step={1} max={1825} size={20} />
        <AutoRow gap="4px" justify="center">
          <SmallMaxButton onClick={() => onPercentSelect(7)} width="20%">
            <span>7 days</span>
          </SmallMaxButton>
          <SmallMaxButton onClick={() => onPercentSelect(30)} width="20%">
            <span>30 days</span>
          </SmallMaxButton>
          <SmallMaxButton onClick={() => onPercentSelect(365)} width="20%">
            <span>1 year</span>
          </SmallMaxButton>
          <SmallMaxButton onClick={() => onPercentSelect(1825)} width="20%">
            <span>5 years</span>
          </SmallMaxButton>
        </AutoRow>
        <OutlineCard padding="0.5rem" $borderRadius="0.3rem">
          <AutoRow style={{ alignItems: 'start' }}>
            <TYPE.darkGray flex={1}>veCYS Balance</TYPE.darkGray>
            <AutoColumn gap="5px" style={{ flex: 1 }}>
              <TYPE.darkGray fontSize={12}>
                Prev:{' '}
                <Text display="inline" fontSize={14} color="white">
                  0
                </Text>
              </TYPE.darkGray>
              <TYPE.darkGray fontSize={12}>
                Next:{' '}
                <Text display="inline" fontSize={14} color="white">
                  0.1345
                </Text>
              </TYPE.darkGray>
            </AutoColumn>
          </AutoRow>
        </OutlineCard>
        <OutlineCard padding="0.5rem" $borderRadius="0.3rem">
          <AutoRow style={{ alignItems: 'start' }}>
            <TYPE.darkGray flex={1}>Unlock Time</TYPE.darkGray>
            <AutoColumn gap="5px" style={{ flex: 1 }}>
              <TYPE.darkGray fontSize={12}>
                Prev:{' '}
                <Text display="inline" fontSize={14} color="white">
                  n/a
                </Text>
              </TYPE.darkGray>
              <TYPE.darkGray fontSize={12}>
                Next:{' '}
                <Text display="inline" fontSize={14} color="white">
                  {new Date().toLocaleDateString()}
                </Text>
              </TYPE.darkGray>
            </AutoColumn>
          </AutoRow>
        </OutlineCard>
        <ResponsiveButtonPrimary style={{ marginTop: 0, width: '100%' }}>
          {extend ? 'Extend Lockup' : 'Lock Tokens'}
        </ResponsiveButtonPrimary>
      </ColumnCenter>
    </ColumnCenter>
  )
}

function VoteLocker() {
  const history = useHistory()
  const [isLockOpen, setIsLockOpen] = useState(false)
  const [isExtendOpen, setIsExtendOpen] = useState(false)
  const [isNewUser, setIsNewUser] = useState(true)

  const onDismiss = useCallback(() => {
    setIsLockOpen(false)
    setIsExtendOpen(false)
  }, [setIsLockOpen])

  const handleStakingRedirect = () => {
    history.push('/staking')
  }

  return (
    <>
      <Modal isOpen={isLockOpen} onDismiss={onDismiss} closeOnOutsideClick maxHeight={80} minHeight={60}>
        <LockTokensModal onDismiss={onDismiss} />
      </Modal>
      <Modal isOpen={isExtendOpen} onDismiss={onDismiss} closeOnOutsideClick maxHeight={80} minHeight={60}>
        <LockTokensModal onDismiss={onDismiss} extend />
      </Modal>
      <PageWrapper>
        <AutoColumn gap="md" justify="center">
          <TitleRow style={{ padding: '0 0.5em', marginTop: '1rem' }}>
            <TYPE.largeHeader>
              <span>Vote Locker</span>
            </TYPE.largeHeader>
          </TitleRow>
          <AutoRow gap="6px" style={{ width: '100%' }}>
            <BannerCard flex="2">Some Info blahh blahhh</BannerCard>
            <BannerCard flex="1" onClick={handleStakingRedirect} style={{ cursor: 'pointer' }}>
              Staking
            </BannerCard>
          </AutoRow>
          <AutoRow gap="6px" style={{ width: '100%' }}>
            <MainContentWrapper flex="3">
              <TYPE.mediumHeader letterSpacing={1.5} color="text2" style={{ padding: '0.6rem' }}>
                <span style={{ fontWeight: 700 }}>Voting Wallet</span>
              </TYPE.mediumHeader>
              <Divider />
              <AutoColumn gap="sm" style={{ padding: '0 1rem', margin: '1rem 0' }}>
                <TYPE.small fontSize={14} color="text2">
                  CYS Balance
                </TYPE.small>
                <TYPE.mediumHeader>
                  {(0.0).toFixed(6)} &nbsp;
                  <IconWrapper>
                    <img src={CYS_ICON} />
                  </IconWrapper>
                </TYPE.mediumHeader>
              </AutoColumn>
              <Divider />
              <AutoColumn gap="sm" style={{ padding: '0 1rem', margin: '1rem 0' }}>
                <TYPE.small fontSize={14} color="text2">
                  Locked CYS
                </TYPE.small>
                <TYPE.mediumHeader>
                  {(0.0).toFixed(6)} &nbsp;
                  <IconWrapper>
                    <img src={CYS_ICON} />
                  </IconWrapper>
                </TYPE.mediumHeader>
              </AutoColumn>
              <Divider />
              <AutoRow>
                <ResponsiveButtonPrimary onClick={() => setIsLockOpen(true)}>Lock</ResponsiveButtonPrimary>
                <ResponsiveButtonPrimary disabled={isNewUser} onClick={() => setIsExtendOpen(true)}>
                  Extend
                </ResponsiveButtonPrimary>
              </AutoRow>
            </MainContentWrapper>
            <MainContentWrapper flex="5">
              <TYPE.mediumHeader
                letterSpacing={1.5}
                color="text2"
                style={{ padding: '0.6rem 1rem' }}
                onClick={() => setIsNewUser((p) => !p)}
              >
                <span style={{ fontWeight: 700 }}>{isNewUser ? 'Setup Voting' : 'Your Lockup'}</span>
              </TYPE.mediumHeader>
              <Divider />
              {isNewUser ? (
                <AutoColumn gap="md" style={{ padding: '0 1rem', marginTop: '1rem' }}>
                  <TYPE.body fontSize={14}>
                    Participating in CYS Governance requires that an account have a balance of vote-escrowed CYS
                    (veCYS). To participate in governance, you must lock up Cyclos Protocol Token for a period of time.
                  </TYPE.body>
                  <TYPE.body fontSize={14}>
                    veCYS cannot be transferred. The only way to obtain veCYS is by locking CYS. The maximum lock time
                    is 4 years, 11 months, 30 days. One CYS locked for 4 years, 11 months, 30 days provides an initial
                    balance of 10 veCYS.
                  </TYPE.body>
                  <ExternalLink href="https://docs.tribeca.so/voting-escrow/#voting-escrow-tokens" target="_blank">
                    <TYPE.link fontSize={13}>Learn More &#8599;</TYPE.link>
                  </ExternalLink>
                  <GetStartedBtn onClick={() => setIsLockOpen(true)}>Get Started</GetStartedBtn>
                </AutoColumn>
              ) : (
                <AutoColumn gap="md" style={{ padding: '0 1rem', marginTop: '1rem' }}>
                  <TYPE.small fontSize={14} color="text2">
                    veCYS Balance
                  </TYPE.small>
                  <TYPE.mediumHeader>
                    {(0.0).toFixed(6)} &nbsp;
                    <IconWrapper>
                      <img src={CYS_ICON} />
                    </IconWrapper>
                  </TYPE.mediumHeader>
                  <Divider />
                  <TYPE.small fontSize={14} color="text2">
                    Time Remaining
                  </TYPE.small>
                  <TYPE.mediumHeader>
                    6&nbsp;
                    <small>days</small>
                  </TYPE.mediumHeader>
                  <Divider />
                  <TYPE.small fontSize={14} color="text2">
                    Unlock Time
                  </TYPE.small>
                  <TYPE.label>{new Date().toUTCString()}</TYPE.label>
                </AutoColumn>
              )}
            </MainContentWrapper>
          </AutoRow>
        </AutoColumn>
      </PageWrapper>
    </>
  )
}

export default VoteLocker
