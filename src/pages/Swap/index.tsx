import { useWalletKit } from '@gokiprotocol/walletkit'
import { useSolana } from '@saberhq/use-solana'
import { Currency, CurrencyAmount, Fraction, Token, TradeType } from '@cykura/sdk-core'
import { Trade as V3Trade } from '@cykura/sdk'
import { AdvancedSwapDetails } from 'components/swap/AdvancedSwapDetails'
import { MouseoverTooltipContent } from 'components/Tooltip'
import useDebounce from 'hooks/useDebounce'
import useVerifyATA from 'hooks/useVerifyATA'
import JSBI from 'jsbi'
import { useCallback, useContext, useMemo, useState } from 'react'
import { ArrowDown, Info } from 'react-feather'
import ReactGA from 'react-ga'
import { RouteComponentProps } from 'react-router-dom'
import { Text } from 'rebass'
import styled, { ThemeContext } from 'styled-components/macro'
import AddressInputPanel from '../../components/AddressInputPanel'
import { ButtonError, ButtonGray, ButtonLight, ButtonPrimary } from '../../components/Button'
import { GreyCard } from '../../components/Card'
import { AutoColumn } from '../../components/Column'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import Row, { AutoRow, RowFixed } from '../../components/Row'
import confirmPriceImpactWithoutFee from '../../components/swap/confirmPriceImpactWithoutFee'
import ConfirmSwapModal from '../../components/swap/ConfirmSwapModal'
import { ArrowWrapper, Dots, SwapCallbackError, Wrapper } from '../../components/swap/styleds'
import SwapHeader from '../../components/swap/SwapHeader'
import TradePrice from '../../components/swap/TradePrice'
import { SwitchLocaleLink } from '../../components/SwitchLocaleLink'
import { useCurrency } from '../../hooks/Tokens'
import { V3TradeState } from '../../hooks/useBestV3Trade'
import { useSwapCallback } from '../../hooks/useSwapCallback'
import { useUSDCValue } from '../../hooks/useUSDCPrice'
import { useActiveWeb3ReactSol } from '../../hooks/web3'
import { Field } from '../../state/swap/actions'
import {
  useDefaultsFromURLSearch,
  useDerivedSwapInfo,
  useSwapActionHandlers,
  useSwapState,
} from '../../state/swap/hooks'
import { useExpertModeManager, useUserSingleHopOnly } from '../../state/user/hooks'
import { LinkStyledButton, TYPE } from '../../theme'
import { computeFiatValuePriceImpact } from '../../utils/computeFiatValuePriceImpact'
import { maxAmountSpend } from '../../utils/maxAmountSpend'
import { warningSeverity } from '../../utils/prices'
import AppBody from '../AppBody'

const StyledInfo = styled(Info)`
  opacity: 0.4;
  color: ${({ theme }) => theme.text1};
  height: 16px;
  width: 16px;
  :hover {
    opacity: 0.8;
  }
`

export default function Swap({ history }: RouteComponentProps) {
  const { account } = useActiveWeb3ReactSol()
  const { connect } = useWalletKit()
  const { connected } = useSolana()
  const loadedUrlParams = useDefaultsFromURLSearch()

  // token warning stuff
  const [loadedInputCurrency, loadedOutputCurrency] = [
    useCurrency(loadedUrlParams?.inputCurrencyId),
    useCurrency(loadedUrlParams?.outputCurrencyId),
  ]

  const theme = useContext(ThemeContext)

  // for expert mode
  const [isExpertMode] = useExpertModeManager()

  // swap state
  const { independentField, typedValue, recipient } = useSwapState()
  const {
    v3TradeState: { trade: v3Trade, state: v3TradeState, accounts: swapAccounts },
    toggledTrade: trade,
    allowedSlippage,
    currencyBalances,
    parsedAmount,
    currencies,
    inputError: swapInputError,
  } = useDerivedSwapInfo()
  console.log('swap accounts', swapAccounts)

  // const tokensList = useMemo(
  //   () =>
  //     [currencies[Field.INPUT]?.wrapped?.address, currencies[Field.OUTPUT]?.wrapped?.address].filter(
  //       (t): t is string => !!t
  //     ),
  //   [currencies]
  // )
  // const { haveAllATAs, createATA } = useVerifyATA(tokensList)
  // console.log(trade?.inputAmount.toSignificant(), trade?.outputAmount.toSignificant())
  // let trade: V3Trade<Currency, Currency, TradeType> | undefined
  // const {
  //   wrapType,
  //   execute: onWrap,
  //   inputError: wrapInputError,
  // } = useWrapCallback(currencies[Field.INPUT], currencies[Field.OUTPUT], typedValue)
  // const showWrap: boolean = wrapType !== WrapType.NOT_APPLICABLE
  const recipientAddress = recipient

  const parsedAmounts = useMemo(() => {
    return {
      [Field.INPUT]: independentField === Field.INPUT ? parsedAmount : trade?.inputAmount,
      [Field.OUTPUT]: independentField === Field.OUTPUT ? parsedAmount : trade?.outputAmount,
    }
  }, [independentField, parsedAmount, trade])

  const fiatValueInput = useUSDCValue(parsedAmounts[Field.INPUT])
  const fiatValueOutput = useUSDCValue(parsedAmounts[Field.OUTPUT])
  const priceImpact = computeFiatValuePriceImpact(fiatValueInput, fiatValueOutput)

  const { onSwitchTokens, onCurrencySelection, onUserInput, onChangeRecipient } = useSwapActionHandlers()
  const isValid = !swapInputError
  const dependentField: Field = independentField === Field.INPUT ? Field.OUTPUT : Field.INPUT

  const handleTypeInput = useCallback(
    (value: string) => {
      onUserInput(Field.INPUT, value)
    },
    [onUserInput]
  )
  const handleTypeOutput = useCallback(
    (value: string) => {
      onUserInput(Field.OUTPUT, value)
    },
    [onUserInput]
  )

  // modal and loading
  const [{ showConfirm, tradeToConfirm, swapErrorMessage, attemptingTxn, txHash }, setSwapState] = useState<{
    showConfirm: boolean
    tradeToConfirm: V3Trade<Currency, Currency, TradeType> | undefined
    attemptingTxn: boolean
    swapErrorMessage: string | undefined
    txHash: string | undefined
  }>({
    showConfirm: false,
    tradeToConfirm: undefined,
    attemptingTxn: false,
    swapErrorMessage: undefined,
    txHash: undefined,
  })

  const formattedAmounts = {
    [independentField]: typedValue,
    [dependentField]: parsedAmounts[dependentField]?.toSignificant(6) ?? '',
  }

  const userHasSpecifiedInputOutput = Boolean(
    currencies[Field.INPUT] &&
      currencies[Field.OUTPUT] &&
      parsedAmounts[independentField]?.greaterThan(new Fraction(0, 1))
  )
  const routeNotFound = !trade?.route
  // const isLoadingRoute = false
  const isLoadingRoute = V3TradeState.LOADING === v3TradeState
  // const {
  //   state: signatureState,
  //   signatureData,
  //   gatherPermitSignature,
  // } = useERC20PermitFromTrade(trade, allowedSlippage)

  const maxInputAmount: CurrencyAmount<Currency> | undefined = maxAmountSpend(currencyBalances[Field.INPUT])
  const showMaxButton = Boolean(maxInputAmount?.greaterThan(0) && !parsedAmounts[Field.INPUT]?.equalTo(maxInputAmount))

  // the callback to execute the swap
  // console.log(trade, v3Trade)
  const { callback: swapCallback, error: swapCallbackError } = useSwapCallback(
    trade,
    allowedSlippage,
    recipient,
    swapAccounts
  )

  const [singleHopOnly] = useUserSingleHopOnly()

  const handleSwap = useCallback(() => {
    // async function handleSwap() {
    if (!swapCallback) {
      return
    }

    setSwapState({
      attemptingTxn: true,
      tradeToConfirm,
      showConfirm,
      swapErrorMessage: undefined,
      txHash: undefined,
    })
    swapCallback()
      .then((hash: any) => {
        setSwapState({
          attemptingTxn: false,
          tradeToConfirm,
          showConfirm,
          swapErrorMessage: undefined,
          txHash: hash,
        })
      })
      .catch((error: any) => {
        setSwapState({
          attemptingTxn: false,
          tradeToConfirm,
          showConfirm,
          swapErrorMessage: error.message,
          txHash: undefined,
        })
        console.log(error)
      })
  }, [
    priceImpact,
    swapCallback,
    tradeToConfirm,
    showConfirm,
    recipient,
    recipientAddress,
    account,
    trade,
    singleHopOnly,
  ])

  // errors
  const [showInverted, setShowInverted] = useState<boolean>(false)

  // // warnings on the greater of fiat value price impact and execution price impact
  const priceImpactSeverity = useMemo(() => {
    const executionPriceImpact = trade?.priceImpact
    return warningSeverity(
      executionPriceImpact && priceImpact
        ? executionPriceImpact.greaterThan(priceImpact)
          ? executionPriceImpact
          : priceImpact
        : executionPriceImpact ?? priceImpact
    )
  }, [priceImpact, trade])

  const handleConfirmDismiss = useCallback(() => {
    setSwapState({ showConfirm: false, tradeToConfirm, attemptingTxn, swapErrorMessage, txHash })
    // if there was a tx hash, we want to clear the input
    if (txHash) {
      onUserInput(Field.INPUT, '')
    }
  }, [attemptingTxn, onUserInput, swapErrorMessage, tradeToConfirm, txHash])

  const handleAcceptChanges = useCallback(() => {
    // console.log('accepted')
    setSwapState({ tradeToConfirm: trade, swapErrorMessage, txHash, attemptingTxn, showConfirm })
  }, [attemptingTxn, showConfirm, swapErrorMessage, trade, txHash])

  const handleInputSelect = useCallback(
    (inputCurrency) => {
      onCurrencySelection(Field.INPUT, inputCurrency)
    },
    [onCurrencySelection]
  )

  const handleMaxInput = useCallback(() => {
    maxInputAmount && onUserInput(Field.INPUT, maxInputAmount.toExact())
  }, [maxInputAmount, onUserInput])

  const handleOutputSelect = useCallback(
    (outputCurrency) => onCurrencySelection(Field.OUTPUT, outputCurrency),
    [onCurrencySelection]
  )

  const priceImpactTooHigh = priceImpactSeverity > 3 && !isExpertMode
  // const priceImpactTooHigh = priceImpactSeverity > 3
  // const priceImpactTooHigh = false

  return (
    <>
      {/* <TokenWarningModal
        isOpen={importTokensNotInDefault.length > 0 && !dismissTokenWarning}
        tokens={importTokensNotInDefault}
        onConfirm={handleConfirmTokenWarning}
        onDismiss={handleDismissTokenWarning}
      /> */}
      <AppBody>
        <SwapHeader allowedSlippage={allowedSlippage} />
        <Wrapper id="swap-page">
          <ConfirmSwapModal
            isOpen={showConfirm}
            trade={trade}
            originalTrade={tradeToConfirm}
            onAcceptChanges={handleAcceptChanges}
            attemptingTxn={attemptingTxn}
            txHash={txHash}
            recipient={recipient}
            allowedSlippage={allowedSlippage}
            onConfirm={handleSwap}
            swapErrorMessage={swapErrorMessage}
            onDismiss={handleConfirmDismiss}
          />

          <AutoColumn gap={'md'}>
            <div style={{ display: 'relative' }}>
              <CurrencyInputPanel
                label={independentField === Field.OUTPUT ? <span>From (at most)</span> : null}
                value={formattedAmounts[Field.INPUT]}
                showMaxButton={showMaxButton}
                currency={currencies[Field.INPUT]}
                onUserInput={handleTypeInput}
                onMax={handleMaxInput}
                fiatValue={fiatValueInput ?? undefined}
                onCurrencySelect={handleInputSelect}
                otherCurrency={currencies[Field.OUTPUT]}
                showCommonBases={true}
                id="swap-currency-input"
              />
              <ArrowWrapper clickable>
                <ArrowDown
                  size="16"
                  onClick={onSwitchTokens}
                  color={currencies[Field.INPUT] && currencies[Field.OUTPUT] ? theme.text1 : theme.text3}
                />
              </ArrowWrapper>
              <CurrencyInputPanel
                value={formattedAmounts[Field.OUTPUT]}
                onUserInput={handleTypeOutput}
                label={independentField === Field.INPUT ? <span>To (at least)</span> : null}
                showMaxButton={false}
                hideBalance={false}
                fiatValue={fiatValueOutput ?? undefined}
                priceImpact={priceImpact}
                currency={currencies[Field.OUTPUT]}
                onCurrencySelect={handleOutputSelect}
                otherCurrency={currencies[Field.INPUT]}
                showCommonBases={true}
                id="swap-currency-output"
              />
            </div>

            <Row style={{ justifyContent: !trade ? 'center' : 'space-between' }}>
              {trade ? (
                <>
                  <TradePrice
                    price={trade.executionPrice}
                    showInverted={showInverted}
                    setShowInverted={setShowInverted}
                  />
                  <MouseoverTooltipContent
                    content={<AdvancedSwapDetails trade={trade} allowedSlippage={allowedSlippage} />}
                  >
                    <StyledInfo />
                  </MouseoverTooltipContent>
                </>
              ) : null}
            </Row>

            <div>
              {!connected ? (
                <ButtonLight onClick={connect}>
                  <span>Connect Wallet</span>
                </ButtonLight>
              ) : routeNotFound && userHasSpecifiedInputOutput ? (
                <GreyCard style={{ textAlign: 'center' }}>
                  <TYPE.main mb="4px">
                    {isLoadingRoute ? (
                      <Dots>
                        <span>Loading</span>
                      </Dots>
                    ) : (
                      // : singleHopOnly ? (
                      //   <span>Insufficient liquidity for this trade. Try enabling multi-hop trades.</span>
                      // )
                      <span>Insufficient liquidity for this trade.</span>
                    )}
                  </TYPE.main>
                </GreyCard>
              ) : (
                // ATA check and creation handled within the swap txn
                // : !haveAllATAs && !isValid ? (
                //   <ButtonError onClick={handleCreateATA}>
                //     <Text fontSize={20} fontWeight={500}>
                //       Create Accounts
                //     </Text>
                //   </ButtonError>
                // ) :
                <ButtonError
                  onClick={() => {
                    // handleSwap()
                    setSwapState({
                      tradeToConfirm: trade,
                      attemptingTxn: false,
                      swapErrorMessage: undefined,
                      showConfirm: true,
                      txHash: undefined,
                    })
                    // if (isExpertMode) {
                    //   handleSwap()
                    // } else {
                    //   console.log('setting swap state')
                    //   // setSwapState({
                    //   //   tradeToConfirm: trade,
                    //   //   attemptingTxn: false,
                    //   //   swapErrorMessage: undefined,
                    //   //   showConfirm: true,
                    //   //   txHash: undefined,
                    //   // })
                    // }
                  }}
                  id="swap-button"
                  disabled={!isValid || priceImpactTooHigh || !!swapCallbackError}
                  error={isValid && priceImpactSeverity > 2 && !swapCallbackError}
                >
                  <Text fontSize={20} fontWeight={500}>
                    {swapInputError ? (
                      swapInputError
                    ) : priceImpactTooHigh ? (
                      <span>Price Impact Too High</span>
                    ) : priceImpactSeverity > 2 ? (
                      <span>Swap Anyway</span>
                    ) : (
                      <span>Swap</span>
                    )}
                  </Text>
                </ButtonError>
              )}
              {isExpertMode && swapErrorMessage ? <SwapCallbackError error={swapErrorMessage} /> : null}
            </div>
          </AutoColumn>
        </Wrapper>
      </AppBody>
    </>
  )
}
