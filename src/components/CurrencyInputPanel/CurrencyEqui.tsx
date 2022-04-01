import { Currency, CurrencyAmount, Percent, Token } from '@cykura/sdk-core'
import { useState, useCallback, ReactNode } from 'react'
import styled from 'styled-components/macro'
import { darken } from 'polished'
import { useCurrencyBalance } from '../../state/wallet/hooks'
import { ButtonGray } from '../Button'
import { RowBetween, RowFixed } from '../Row'
import { TYPE } from '../../theme'
import { Input as NumericalInput } from '../NumericalInput'
import { useActiveWeb3ReactSol } from '../../hooks/web3'

import useTheme from '../../hooks/useTheme'
import { FiatValue } from './FiatValue'
import { formatCurrencyAmount } from 'utils/formatCurrencyAmount'

const InputPanel = styled.div<{ hideInput?: boolean }>`
  ${({ theme }) => theme.flexColumnNoWrap}
  position: relative;
  border-radius: ${({ hideInput }) => (hideInput ? '16px' : '20px')};
  background-color: ${({ theme, hideInput }) => (hideInput ? 'transparent' : theme.bg2)};
  z-index: 0;
  width: ${({ hideInput }) => (hideInput ? '100%' : 'initial')};
`

const Container = styled.div<{ hideInput: boolean }>`
  border-radius: ${({ hideInput }) => (hideInput ? '16px' : '20px')};
  border: 1px solid ${({ theme, hideInput }) => (hideInput ? ' transparent' : theme.bg2)};
  background-color: ${({ theme }) => theme.bg1};
  width: ${({ hideInput }) => (hideInput ? '100%' : 'initial')};
  :focus,
  :hover {
    border: 1px solid ${({ theme, hideInput }) => (hideInput ? ' transparent' : theme.bg3)};
  }
`

const InputRow = styled.div<{ selected: boolean }>`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  padding: ${({ selected }) => (selected ? ' 1rem 1rem 0.75rem 1rem' : '1rem 1rem 0.75rem 1rem')};
`

const LabelRow = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  color: ${({ theme }) => theme.text1};
  font-size: 0.75rem;
  line-height: 1rem;
  padding: 0 1rem 1rem;
  span:hover {
    cursor: pointer;
    color: ${({ theme }) => darken(0.2, theme.text2)};
  }
`

const FiatRow = styled(LabelRow)`
  justify-content: flex-end;
`

interface CurrencyEquiProps {
  value: string
  onUserInput: (value: string) => void
  onMax?: () => void
  showMaxButton?: boolean
  label?: ReactNode
  onCurrencySelect?: (currency: Currency) => void
  currency?: Currency | null
  hideBalance?: boolean
  otherCurrency?: Currency | null
  fiatValue?: CurrencyAmount<Token> | null
  priceImpact?: Percent
  id: string
  showCommonBases?: boolean
  showCurrencyAmount?: boolean
  disableNonToken?: boolean
  renderBalance?: (amount: CurrencyAmount<Currency>) => ReactNode
  locked?: boolean
}

export default function CurrencyEqui({
  value,
  onUserInput,
  onMax,
  showMaxButton,
  onCurrencySelect,
  currency,
  otherCurrency,
  id,
  showCommonBases,
  showCurrencyAmount,
  disableNonToken,
  renderBalance,
  fiatValue,
  priceImpact,
  hideBalance = false,

  locked = false,
  ...rest
}: CurrencyEquiProps) {
  const { account } = useActiveWeb3ReactSol()
  const selectedCurrencyBalance = useCurrencyBalance(account ?? undefined, currency ?? undefined)
  const theme = useTheme()

  return (
    <InputPanel id={id} hideInput={false} {...rest}>
      <Container hideInput={false}>
        <InputRow selected={!onCurrencySelect}>
          <NumericalInput
            className="token-amount-input"
            value={value}
            onUserInput={(val) => {
              onUserInput(val)
            }}
          />
        </InputRow>
        {!hideBalance && (
          <FiatRow>
            <RowBetween>
              {account && (
                <RowFixed style={{ height: '17px' }}>
                  <TYPE.body
                    onClick={onMax}
                    color={theme.text2}
                    fontWeight={400}
                    fontSize={14}
                    style={{ display: 'inline', cursor: 'pointer' }}
                  >
                    {!hideBalance && currency && selectedCurrencyBalance ? (
                      renderBalance ? (
                        renderBalance(selectedCurrencyBalance)
                      ) : (
                        <span>{formatCurrencyAmount(selectedCurrencyBalance, 4)} USDC</span>
                      )
                    ) : null}
                  </TYPE.body>
                </RowFixed>
              )}
              <FiatValue fiatValue={fiatValue} priceImpact={priceImpact} />
            </RowBetween>
          </FiatRow>
        )}
      </Container>
    </InputPanel>
  )
}
