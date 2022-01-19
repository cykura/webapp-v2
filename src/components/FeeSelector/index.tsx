import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FeeAmount } from '@uniswap/v3-sdk'
import { Token } from '@uniswap/sdk-core'

import { AutoColumn } from 'components/Column'
import { DynamicSection } from 'pages/AddLiquidity/styled'
import { TYPE } from 'theme'
import { RowBetween } from 'components/Row'
import { ButtonGray, ButtonRadioChecked } from 'components/Button'
import styled, { keyframes } from 'styled-components/macro'
import Badge from 'components/Badge'
import Card from 'components/Card'
import usePrevious from 'hooks/usePrevious'
import { useFeeTierDistribution } from 'hooks/useFeeTierDistribution'
import ReactGA from 'react-ga'
import { Box } from 'rebass'

const pulse = (color: string) => keyframes`
  0% {
    box-shadow: 0 0 0 0 ${color};
  }

  70% {
    box-shadow: 0 0 0 2px ${color};
  }

  100% {
    box-shadow: 0 0 0 0 ${color};
  }
`

const ResponsiveText = styled(TYPE.label)`
  line-height: 16px;

  ${({ theme }) => theme.mediaWidth.upToSmall`
    font-size: 12px;
    line-height: 12px;
  `};
`

const FocusedOutlineCard = styled(Card)<{ pulsing: boolean }>`
  border: 1px solid ${({ theme }) => theme.bg2};
  animation: ${({ pulsing, theme }) => pulsing && pulse(theme.primary1)} 0.6s linear;
`

const FeeAmountLabel = {
  [FeeAmount.LOW]: {
    label: '0.05',
    description: <span>Best for stable pairs.</span>,
  },
  [FeeAmount.MEDIUM]: {
    label: '0.3',
    description: <span>Best for most pairs.</span>,
  },
  [FeeAmount.HIGH]: {
    label: '1',
    description: <span>Best for exotic pairs.</span>,
  },
}

const FeeTierPercentageBadge = ({ percentage }: { percentage: number | undefined }) => {
  return (
    <Badge>
      <TYPE.label fontSize={12}>
        {Boolean(percentage) ? <span>{percentage?.toFixed(0)}% select</span> : <span>Not created</span>}
      </TYPE.label>
    </Badge>
  )
}

export default function FeeSelector({
  disabled = false,
  feeAmount,
  handleFeePoolSelect,
  token0,
  token1,
}: {
  disabled?: boolean
  feeAmount?: FeeAmount
  handleFeePoolSelect: (feeAmount: FeeAmount) => void
  token0?: Token | undefined
  token1?: Token | undefined
}) {
  const { isLoading, isError, largestUsageFeeTier, distributions } = useFeeTierDistribution(token0, token1)

  const [showOptions, setShowOptions] = useState(false)
  const [pulsing, setPulsing] = useState(false)

  const previousFeeAmount = usePrevious(feeAmount)

  const recommended = useRef(false)

  const handleFeePoolSelectWithEvent = useCallback(
    (fee) => {
      ReactGA.event({
        category: 'FeePoolSelect',
        action: 'Manual',
      })
      handleFeePoolSelect(fee)
    },
    [handleFeePoolSelect]
  )

  useEffect(() => {
    if (feeAmount || isLoading || isError) {
      return
    }

    if (!largestUsageFeeTier) {
      // cannot recommend, open options
      setShowOptions(true)
    } else {
      setShowOptions(false)

      recommended.current = true
      ReactGA.event({
        category: 'FeePoolSelect',
        action: ' Recommended',
      })

      handleFeePoolSelect(largestUsageFeeTier)
    }
  }, [feeAmount, isLoading, isError, largestUsageFeeTier, handleFeePoolSelect])

  useEffect(() => {
    setShowOptions(isError)
  }, [isError])

  useEffect(() => {
    if (feeAmount && previousFeeAmount !== feeAmount) {
      setPulsing(true)
    }
  }, [previousFeeAmount, feeAmount])

  return (
    <AutoColumn gap="16px">
      <DynamicSection gap="md" disabled={disabled}>
        <FocusedOutlineCard pulsing={pulsing} onAnimationEnd={() => setPulsing(false)}>
          <RowBetween>
            <AutoColumn>
              {!feeAmount ? (
                <>
                  <TYPE.label>
                    <span>Fee tier</span>
                  </TYPE.label>
                  <TYPE.main fontWeight={400} fontSize="12px" textAlign="left">
                    <span>The % you will earn in fees.</span>
                  </TYPE.main>
                </>
              ) : (
                <>
                  <TYPE.label>
                    <span>{FeeAmountLabel[feeAmount].label}% fee tier</span>
                  </TYPE.label>
                  <Box style={{ width: 'fit-content', marginTop: '8px' }}>
                    {distributions && feeAmount && <FeeTierPercentageBadge percentage={distributions[feeAmount]} />}
                  </Box>
                </>
              )}
            </AutoColumn>

            <ButtonGray onClick={() => setShowOptions(!showOptions)} width="auto" padding="4px" $borderRadius="6px">
              {showOptions ? <span>Hide</span> : <span>Edit</span>}
            </ButtonGray>
          </RowBetween>
        </FocusedOutlineCard>

        {showOptions && (
          <RowBetween>
            <ButtonRadioChecked
              width="32%"
              active={feeAmount === FeeAmount.LOW}
              onClick={() => handleFeePoolSelectWithEvent(FeeAmount.LOW)}
            >
              <AutoColumn gap="sm" justify="flex-start">
                <AutoColumn justify="flex-start" gap="4px">
                  <ResponsiveText>
                    <span>0.05% fee</span>
                  </ResponsiveText>
                  <TYPE.main fontWeight={400} fontSize="12px" textAlign="left">
                    <span>Best for stable pairs.</span>
                  </TYPE.main>
                </AutoColumn>

                {distributions && <FeeTierPercentageBadge percentage={distributions[FeeAmount.LOW]} />}
              </AutoColumn>
            </ButtonRadioChecked>
            <ButtonRadioChecked
              width="32%"
              active={feeAmount === FeeAmount.MEDIUM}
              onClick={() => handleFeePoolSelectWithEvent(FeeAmount.MEDIUM)}
              disabled
            >
              <AutoColumn gap="sm" justify="flex-start">
                <AutoColumn justify="flex-start" gap="4px">
                  <ResponsiveText>
                    <span>0.3% fee</span>
                  </ResponsiveText>
                  <TYPE.main fontWeight={400} fontSize="12px" textAlign="left">
                    <span>Best for most pairs.</span>
                  </TYPE.main>
                </AutoColumn>

                {distributions && <FeeTierPercentageBadge percentage={distributions[FeeAmount.MEDIUM]} />}
              </AutoColumn>
            </ButtonRadioChecked>
            <ButtonRadioChecked
              width="32%"
              active={feeAmount === FeeAmount.HIGH}
              onClick={() => handleFeePoolSelectWithEvent(FeeAmount.HIGH)}
              disabled
            >
              <AutoColumn gap="sm" justify="flex-start">
                <AutoColumn justify="flex-start" gap="4px">
                  <ResponsiveText>
                    <span>1% fee</span>
                  </ResponsiveText>
                  <TYPE.main fontWeight={400} fontSize="12px" textAlign="left">
                    <span>Best for exotic pairs.</span>
                  </TYPE.main>
                </AutoColumn>

                {distributions && <FeeTierPercentageBadge percentage={distributions[FeeAmount.HIGH]} />}
              </AutoColumn>
            </ButtonRadioChecked>
          </RowBetween>
        )}
      </DynamicSection>
    </AutoColumn>
  )
}
