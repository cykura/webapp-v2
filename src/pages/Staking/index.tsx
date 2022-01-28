import useStaking from '../../contexts/Staking'
import React, { useCallback, useEffect, useState } from 'react'
import { PoolType } from 'constants/addresses'
import { RowBetween, RowFixed } from 'components/Row'
import Column, { AutoColumn, ColumnCenter } from 'components/Column'
import styled from 'styled-components/macro'
import { DarkCard } from 'components/Card'
import { useSolana } from '@saberhq/use-solana'
import { useWalletKit } from '@gokiprotocol/walletkit'
import { useSnackbar } from 'notistack'
import { ExternalLink, HideExtraSmall, HideSmall, TYPE } from 'theme'
import { Loader, RefreshCcw, Settings } from 'react-feather'
import { ButtonPrimary, ButtonSecondary } from 'components/Button'
import TransactionConfirmationModal, { ConfirmationModalContent } from 'components/TransactionConfirmationModal'

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

const ContentWrapper = styled(AutoColumn)`
  width: 100%;
  justify-content: center;
  gap: 10px;
  margin-top: 2rem;
  margin-bottom: 2rem;
`
const ResponsiveRow = styled(RowBetween)`
  gap: 16px;
  ${({ theme }) => theme.mediaWidth.upToSmall`
    flex-direction: column;
    align-items: flex-start;
    width: 100%:
  `};
`
const TitleColumn = styled(AutoColumn)`
  margin-top: 6px;
  gap: 10px;
  ${({ theme }) => theme.mediaWidth.upToSmall`
    flex-wrap: wrap;
    width: 100%;
    flex-direction: column;
  `};
`

const InputRow = styled(RowFixed)`
  width: 100%;
  flex-direction: row;
  justify-content: space-between;
  gap: 0.8rem;
  margin: 0.8rem 0;
  flex: 1 1 auto;
`

const ResponsiveButtonPrimary = styled(ButtonPrimary)`
  border-radius: 12px;
  padding: 6px 8px;
  width: 100%;
  color: ${({ theme }) => theme.text5};
  ${({ theme }) => theme.mediaWidth.upToSmall`
    flex: 1 1 auto;
  `};
`

const StyledLoaderButton = styled.button`
  border: none;
  background-color: transparent;
  margin: 0;
  padding: 0;
  border-radius: 0.5rem;
  height: 20px;
  margin-right: 8px;
  margin-bottom: 14px;

  :hover,
  :focus {
    cursor: pointer;
    outline: none;
  }
`

const StyledLoadingIcon = styled(Loader)`
  height: 18px;
  width: 18px;
  animation: rotation 2s linear infinite;

  > * {
    stroke: ${({ theme }) => theme.text2};
  }

  @keyframes rotation {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(359deg);
    }
  }
`
const StyledLoaderIcon = styled(RefreshCcw)`
  height: 18px;
  width: 18px;

  > * {
    stroke: ${({ theme }) => theme.text2};
  }

  :hover {
    opacity: 0.7;
  }
`

const StyledBalanceMax = styled.button<{ disabled?: boolean }>`
  background-color: transparent;
  border: none;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  color: ${({ theme }) => theme.primaryText1};
  opacity: ${({ disabled }) => (!disabled ? 1 : 0.4)};
  pointer-events: ${({ disabled }) => (!disabled ? 'initial' : 'none')};
  margin-left: 0.5rem;

  :focus {
    outline: none;
  }

  ${({ theme }) => theme.mediaWidth.upToExtraSmall`
    margin-right: 0.5rem;
  `};
`

const StyledInput = styled.input<{ disabled?: boolean; fontSize?: string; align?: string }>`
  color: ${({ disabled, theme }) => (disabled ? theme.bg4 : theme.text1)};
  width: 100%;
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
  border-radius: 0.8rem;
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

const StakeCard = (props: any) => {
  const { poolDetails, description, title, poolType, stakeAccountDetails } = props
  const { connect } = useWalletKit()
  const { connected } = useSolana()
  const [inputStake, setInputStake] = useState(0)
  const [inputUnstake, setInputUnstake] = useState(0)
  const { enqueueSnackbar, closeSnackbar } = useSnackbar()
  const { stake, unstake, claim, setReloadNL, setReload2M, getPendingReward } = useStaking()
  const [rewards, setRewards] = useState('')
  const [loading, setLoading] = useState(false)
  const [attemptingTxn, setAttemptingTxn] = useState('')
  const [txnHash, setTxnHash] = useState('')

  useEffect(() => {
    setRewards(getPendingReward(poolType).toFixed(6))
  }, [stakeAccountDetails])

  const formattedStakeAmount = inputStake
    ? inputStake?.toLocaleString('fullwide', {
        maximumFractionDigits: 6,
        useGrouping: false,
      })
    : inputStake?.toString() ?? 0

  const formattedUnstakeAmount = inputUnstake
    ? inputUnstake?.toLocaleString('fullwide', {
        maximumFractionDigits: 6,
        useGrouping: false,
      })
    : inputUnstake?.toString() ?? 0

  const handleStake = async (input: number, poolType: PoolType) => {
    if (!input || input <= 0) {
      enqueueSnackbar('Enter amount to stake', {
        variant: 'error',
      })
      return
    }
    setLoading(true)
    setAttemptingTxn(`Stake ${input} CYS`)
    stake(input, poolType)
      .then((tx: string) => {
        setTxnHash(tx)
        setInputStake(0)
      })
      .catch((err: any) => {
        enqueueSnackbar(err?.message ?? 'Something went wrong', {
          variant: 'error',
        })
      })
      .finally(() => {
        setLoading(false)
        setAttemptingTxn('')
      })
  }

  const handleUnstake = async (input: number, poolType: PoolType) => {
    if (
      poolType === PoolType.TWOLOCK &&
      Date.now() < new Date(+(stakeAccountDetails?.maturityTime.toString() ?? 0) * 1000).getTime()
    ) {
      enqueueSnackbar('Cannot unstake before unlock period.', {
        variant: 'warning',
      })
      return
    }
    if (input > +(stakeAccountDetails?.balanceStaked.toString() ?? 0) / 1e6) {
      enqueueSnackbar('Unstake amount should be less than staked amount', {
        variant: 'error',
      })
      return
    }
    if (!input || input <= 0) {
      enqueueSnackbar('Enter amount to unstake', {
        variant: 'error',
      })
      return
    }
    setLoading(true)
    setAttemptingTxn(`Unstake ${input} CYS`)
    unstake(input, poolType)
      .then((tx: string) => {
        setTxnHash(tx)
        setInputUnstake(0)
      })
      .catch((err: any) => {
        enqueueSnackbar(err?.message ?? 'Something went wrong', {
          variant: 'error',
        })
      })
      .finally(() => {
        setLoading(false)
        setAttemptingTxn('')
      })
  }

  const handleClaim = async (poolType: PoolType) => {
    if (Date.now() < new Date(+(stakeAccountDetails?.maturityTime.toString() ?? 0) * 1000).getTime()) {
      enqueueSnackbar('Cannot claim rewards before unlock period.', {
        variant: 'warning',
      })
      return
    }
    setLoading(true)
    setAttemptingTxn('Claim Tokens')
    claim(poolType)
      .then((tx: string) => {
        setTxnHash(tx)
      })
      .catch((err: any) => {
        enqueueSnackbar(err?.message || 'Something went wrong', {
          variant: 'error',
        })
      })
      .finally(() => {
        setLoading(false)
        setAttemptingTxn('')
      })
  }

  const handleReload = () => {
    setLoading(true)
    if (poolType === PoolType.NOLOCK) {
      setReloadNL((p: boolean) => !p)
    } else if (poolType === PoolType.TWOLOCK) {
      setReload2M((p: boolean) => !p)
    }
    setTimeout(() => setLoading(false), 1100)
  }

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
      <DarkCard
        width="100%"
        height="100%"
        style={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          justifyContent: 'space-around',
        }}
      >
        <RowBetween>
          <TitleColumn>
            <TYPE.largeHeader letterSpacing={1.5}>
              <span style={{ fontWeight: 700 }}>{title}</span>
            </TYPE.largeHeader>
            <TYPE.subHeader color="text2">
              <span>{description}</span>
            </TYPE.subHeader>
          </TitleColumn>
          {connected && (
            <StyledLoaderButton onClick={handleReload}>
              {loading ? <StyledLoadingIcon /> : <StyledLoaderIcon />}
            </StyledLoaderButton>
          )}
        </RowBetween>
        <br />
        <br />
        {connected ? (
          <>
            <RowBetween style={{ padding: '0 1.5rem' }}>
              <AutoColumn gap="0.5rem">
                <TYPE.small color="text2" textAlign="center">
                  TVL
                </TYPE.small>
                <TYPE.mediumHeader textAlign="center">
                  {poolDetails?.tvl?.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) ?? '0'}
                  &nbsp;
                  <small>CYS</small>
                </TYPE.mediumHeader>
              </AutoColumn>
              <AutoColumn gap="0.5rem">
                <TYPE.small color="text2" textAlign="center">
                  APR
                </TYPE.small>
                <TYPE.mediumHeader textAlign="center">
                  {poolDetails.apr == Infinity ? (
                    '-'
                  ) : (
                    <>
                      {poolDetails.apr?.toLocaleString(undefined, {
                        style: 'percent',
                      }) ?? '-'}
                      &nbsp;
                      {poolDetails.apr && <small>%</small>}
                    </>
                  )}
                </TYPE.mediumHeader>
              </AutoColumn>
            </RowBetween>
            <ContentWrapper>
              <TYPE.white fontSize="3rem" fontWeight={600} textAlign="center">
                {parseFloat(rewards)?.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}
              </TYPE.white>
              <TYPE.label color="text2" textAlign="center">
                CYS Earned
              </TYPE.label>
            </ContentWrapper>
            <RowBetween>
              <AutoColumn gap="0.5rem" style={{ flex: 1 }}>
                <TYPE.small color="text2" textAlign="center">
                  Staked
                </TYPE.small>
                <TYPE.mediumHeader textAlign="center">
                  {(parseFloat(stakeAccountDetails?.balanceStaked.toString() ?? 0) / 1e6)?.toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}
                  &nbsp;<small>CYS</small>
                </TYPE.mediumHeader>
              </AutoColumn>
              <AutoColumn gap="0.5rem" style={{ flex: 1 }}>
                <TYPE.small color="text2" textAlign="center">
                  Unlock Time
                </TYPE.small>
                <TYPE.mediumHeader textAlign="center">
                  {poolType === PoolType.NOLOCK ? (
                    <span>-</span>
                  ) : (
                    <span>
                      {!stakeAccountDetails?.maturityTime
                        ? '-'
                        : new Date(parseInt(stakeAccountDetails?.maturityTime.toString() ?? 0) * 1000)
                            .toString()
                            .slice(3, 15)}
                    </span>
                  )}
                </TYPE.mediumHeader>
              </AutoColumn>
            </RowBetween>
            <br />
            <InputRow>
              <ColumnCenter>
                <TYPE.subHeader color="text2" style={{ width: '100%' }}>
                  &nbsp;Stake Amount
                </TYPE.subHeader>
                <StyledInput
                  type="number"
                  placeholder="Enter amount to Stake"
                  min={0}
                  step={0.1}
                  value={formattedStakeAmount ?? null}
                  onChange={(e) => setInputStake(parseFloat(e.target.value))}
                />
                <ResponsiveButtonPrimary onClick={() => handleStake(inputStake, poolType)}>
                  Stake
                </ResponsiveButtonPrimary>
              </ColumnCenter>
              <ColumnCenter>
                <TYPE.subHeader color="text2" style={{ width: '100%' }}>
                  &nbsp;Unstake Amount
                  <HideExtraSmall>
                    <StyledBalanceMax
                      disabled={parseInt(stakeAccountDetails?.balanceStaked.toString() ?? 0) === 0}
                      onClick={() =>
                        setInputUnstake(parseFloat(stakeAccountDetails?.balanceStaked.toString() ?? 0) / 1e6)
                      }
                    >
                      (Max)
                    </StyledBalanceMax>
                  </HideExtraSmall>
                </TYPE.subHeader>
                <StyledInput
                  type="number"
                  placeholder="Enter amount to Unstake"
                  min={0}
                  step={0.1}
                  disabled={parseInt(stakeAccountDetails?.balanceStaked.toString() ?? 0) === 0}
                  value={formattedUnstakeAmount ?? null}
                  onChange={(e) => setInputUnstake(parseFloat(e.target.value))}
                />
                <ResponsiveButtonPrimary
                  disabled={parseInt(stakeAccountDetails?.balanceStaked.toString() ?? 0) === 0}
                  onClick={() => handleUnstake(inputUnstake, poolType)}
                >
                  Unstake
                </ResponsiveButtonPrimary>
              </ColumnCenter>
            </InputRow>
            <ButtonSecondary
              disabled={!+stakeAccountDetails?.balanceStaked?.toString()}
              onClick={() => handleClaim(poolType)}
            >
              Claim Rewards
            </ButtonSecondary>
          </>
        ) : (
          <>
            <ContentWrapper>
              <TYPE.label color="text2" textAlign="center">
                APR
              </TYPE.label>
              <TYPE.white fontSize="3.5rem" fontWeight={800} textAlign="center">
                {poolDetails.apr == Infinity ? (
                  '-'
                ) : (
                  <>
                    {poolDetails.apr?.toLocaleString(undefined, {
                      style: 'percent',
                    }) ?? '-'}
                    &nbsp;
                    {poolDetails.apr && <small>%</small>}
                  </>
                )}
              </TYPE.white>
              <TYPE.label color="text2" marginTop={2} textAlign="center">
                Total Value Locked
              </TYPE.label>
              <TYPE.white fontSize="1.5rem" fontWeight={700} textAlign="center">
                {poolDetails?.tvl?.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) ?? '0'}
                &nbsp;
                <small>CYS</small>
              </TYPE.white>
            </ContentWrapper>
            <br />
            <br />
            <ButtonPrimary onClick={connect}>Connect Wallet to Stake</ButtonPrimary>
          </>
        )}
      </DarkCard>
    </>
  )
}

function Staking() {
  const { poolNoLockDetails, pool2mLockDetails, stakeAccountNoLock, stakeAccount2mLock } = useStaking()

  return (
    <PageWrapper>
      <AutoColumn gap="xl" justify="center">
        <ResponsiveRow>
          <StakeCard
            poolDetails={poolNoLockDetails}
            description={'You can unstake from this pool anytime'}
            title={'CYS-NL'}
            poolType={PoolType.NOLOCK}
            stakeAccountDetails={stakeAccountNoLock}
          />
          <StakeCard
            poolDetails={pool2mLockDetails}
            description={'Your funds will be locked for 2 months'}
            title={'CYS-2M'}
            poolType={PoolType.TWOLOCK}
            stakeAccountDetails={stakeAccount2mLock}
          />
        </ResponsiveRow>
      </AutoColumn>
    </PageWrapper>
  )
}

export default Staking
