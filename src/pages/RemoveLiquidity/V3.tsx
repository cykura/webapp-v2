import { useCallback, useMemo, useState } from 'react'
import { useV3PositionFromTokenId } from 'hooks/useV3Positions'
import { Redirect, RouteComponentProps, useHistory } from 'react-router-dom'
import {
  BITMAP_SEED,
  OBSERVATION_SEED,
  SOLCYS_LOCAL,
  TICK_SEED,
  POOL_SEED,
  POSITION_SEED,
} from '../../constants/tokens'
import { calculateGasMargin } from '../../utils/calculateGasMargin'
import AppBody from '../AppBody'
import { BigNumber } from '@ethersproject/bignumber'
import useDebouncedChangeHandler from 'hooks/useDebouncedChangeHandler'
import { useBurnV3ActionHandlers, useBurnV3State, useDerivedV3BurnInfo } from 'state/burn/v3/hooks'
import Slider from 'components/Slider'
import { AutoRow, RowBetween, RowFixed } from 'components/Row'
import TransactionConfirmationModal, { ConfirmationModalContent } from '../../components/TransactionConfirmationModal'
import { AutoColumn } from 'components/Column'
import { ButtonConfirmed, ButtonPrimary } from 'components/Button'
import { LightCard } from 'components/Card'
import { Text } from 'rebass'
import CurrencyLogo from 'components/CurrencyLogo'
import FormattedCurrencyAmount from 'components/FormattedCurrencyAmount'
import { useV3NFTPositionManagerContract } from 'hooks/useContract'
import { useUserSlippageToleranceWithDefault } from 'state/user/hooks'
import useTransactionDeadline from 'hooks/useTransactionDeadline'
import ReactGA from 'react-ga'
import { useActiveWeb3ReactSol } from 'hooks/web3'
import { TransactionResponse } from '@ethersproject/providers'
import { useTransactionAdder } from 'state/transactions/hooks'
import { Percent } from '@cykura/sdk-core'
import { TYPE } from 'theme'
import { Wrapper, SmallMaxButton, ResponsiveHeaderText } from './styled'
import Loader from 'components/Loader'
import DoubleCurrencyLogo from 'components/DoubleLogo'
import { NonfungiblePositionManager, u32ToSeed } from '@cykura/sdk'
import useTheme from 'hooks/useTheme'
import { AddRemoveTabs } from 'components/NavigationTabs'
import RangeBadge from 'components/Badge/RangeBadge'
import Toggle from 'components/Toggle'
import JSBI from 'jsbi'
import * as anchor from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT } from '@solana/spl-token'
import { PROGRAM_ID_STR } from '../../constants/addresses'
import { CyclosCore, IDL } from 'types/cyclos-core'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { u16ToSeed } from 'state/mint/v3/utils'
import { useSnackbar } from 'notistack'
import { useSolana } from '@saberhq/use-solana'
import { useCurrency } from 'hooks/Tokens'
import { Transaction } from '@solana/web3.js'

const DEFAULT_REMOVE_V3_LIQUIDITY_SLIPPAGE_TOLERANCE = new Percent(5, 100)

// redirect invalid tokenIds
export default function RemoveLiquidityV3({
  location,
  match: {
    params: { tokenId },
  },
}: RouteComponentProps<{ tokenId: string }>) {
  const parsedTokenId = useMemo(() => {
    try {
      return tokenId
    } catch {
      return undefined
    }
  }, [tokenId])

  if (parsedTokenId === undefined) {
    return <Redirect to={{ ...location, pathname: '/pool' }} />
  }

  return <Remove tokenId={parsedTokenId} />
}
function Remove({ tokenId }: { tokenId: string | undefined }) {
  const { position } = useV3PositionFromTokenId(tokenId)
  const theme = useTheme()
  const { account, chainId, librarySol } = useActiveWeb3ReactSol()
  const { enqueueSnackbar } = useSnackbar()
  const { wallet, connection, providerMut } = useSolana()

  const { PublicKey } = anchor.web3
  const { BN } = anchor

  // flag for receiving WETH
  const [receiveWETH, setReceiveWETH] = useState(false)

  // burn state
  const { percent } = useBurnV3State()
  const {
    position: positionSDK,
    liquidityPercentage,
    liquidityValue0,
    liquidityValue1,
    feeValue0,
    feeValue1,
    outOfRange,
    error,
  } = useDerivedV3BurnInfo(position, receiveWETH)
  const { onPercentSelect } = useBurnV3ActionHandlers()

  const removed = JSBI.EQ(position?.liquidity, 0)

  // boilerplate for the slider
  const [percentForSlider, onPercentSelectForSlider] = useDebouncedChangeHandler(percent, onPercentSelect)

  // const deadline = useTransactionDeadline() // custom from users settings
  const deadline = new BN(Date.now() / 1000 + 10_000)
  const allowedSlippage = useUserSlippageToleranceWithDefault(DEFAULT_REMOVE_V3_LIQUIDITY_SLIPPAGE_TOLERANCE) // custom from users

  const [showConfirm, setShowConfirm] = useState(false)
  const [attemptingTxn, setAttemptingTxn] = useState(false)
  const [txnHash, setTxnHash] = useState<string | undefined>()
  const addTransaction = useTransactionAdder()
  const positionManager = useV3NFTPositionManagerContract()

  // Fetch tokens from position
  const currencyA = useCurrency(position?.token0)
  const currencyB = useCurrency(position?.token1)

  async function OnBurn() {
    // throw error here or handle this case in a better way?
    if (!wallet?.publicKey || !currencyA?.wrapped.address || !currencyB?.wrapped.address || !position) return

    const tokenA = currencyA?.wrapped
    const tokenB = currencyB?.wrapped
    const [tk1, tk2] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]

    const token0 = new anchor.web3.PublicKey(tk1.address)
    const token1 = new anchor.web3.PublicKey(tk2.address)
    // console.log(token0.toString(), token1.toString())

    const provider = new anchor.Provider(connection, wallet as Wallet, {
      skipPreflight: false,
    })
    const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)

    setAttemptingTxn(true)
    if (
      !liquidityValue0 ||
      !liquidityValue1 ||
      !deadline ||
      !account ||
      !chainId ||
      !feeValue0 ||
      !feeValue1 ||
      !positionSDK ||
      !liquidityPercentage ||
      !tokenId
    ) {
      return
    }

    console.log(`Position Liq ${positionSDK.liquidity.toString()}`)
    // const hundred = new BN(position.liquidity.toString())
    // const max = new BN(2).pow(new BN(64)).subn(1)

    const removeLiquidityAmount =
      +liquidityPercentage.toSignificant() >= 100
        ? new BN(positionSDK.liquidity.toString())
        : new BN(
            liquidityPercentage
              ?.multiply(JSBI.divide(JSBI.BigInt(positionSDK?.liquidity.toString()), JSBI.BigInt(100)).toString())
              .toSignificant()
          )

    console.log(`Removing liq ${removeLiquidityAmount.toString()}`)

    const fee = position.fee
    const tickSpacing = fee / 50

    const amount0Minimum = new BN(0)
    const amount1Minimum = new BN(0)

    const tickLower = position.tickLower
    const tickUpper = position.tickUpper
    const wordPosLower = (tickLower / tickSpacing) >> 8
    const wordPosUpper = (tickUpper / tickSpacing) >> 8

    // create pool state
    const [poolState, poolStateBump] = await PublicKey.findProgramAddress(
      [POOL_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee)],
      cyclosCore.programId
    )

    const [factoryState, factoryStateBump] = await PublicKey.findProgramAddress([], cyclosCore.programId)

    const [corePositionState, corePositionBump] = await PublicKey.findProgramAddress(
      [
        POSITION_SEED,
        token0.toBuffer(),
        token1.toBuffer(),
        u32ToSeed(fee),
        factoryState.toBuffer(),
        u32ToSeed(tickLower),
        u32ToSeed(tickUpper),
      ],
      cyclosCore.programId
    )

    const [tickLowerState, tickLowerStateBump] = await PublicKey.findProgramAddress(
      [TICK_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee), u32ToSeed(tickLower)],
      cyclosCore.programId
    )

    const [tickUpperState, tickUpperStateBump] = await PublicKey.findProgramAddress(
      [TICK_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee), u32ToSeed(tickUpper)],
      cyclosCore.programId
    )

    const [bitmapLowerState, bitmapLowerBump] = await PublicKey.findProgramAddress(
      [BITMAP_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee), u16ToSeed(wordPosLower)],
      cyclosCore.programId
    )
    const [bitmapUpperState, bitmapUpperBump] = await PublicKey.findProgramAddress(
      [BITMAP_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee), u16ToSeed(wordPosUpper)],
      cyclosCore.programId
    )

    const { observationIndex, observationCardinalityNext } = await cyclosCore.account.poolState.fetch(poolState)

    const lastObservationState = (
      await PublicKey.findProgramAddress(
        [OBSERVATION_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee), u16ToSeed(observationIndex)],
        cyclosCore.programId
      )
    )[0]

    const nextObservationState = (
      await PublicKey.findProgramAddress(
        [
          OBSERVATION_SEED,
          token0.toBuffer(),
          token1.toBuffer(),
          u32ToSeed(fee),
          u16ToSeed((observationIndex + 1) % observationCardinalityNext),
        ],
        cyclosCore.programId
      )
    )[0]

    const nftMint = new PublicKey(tokenId)

    const positionNftAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      nftMint,
      wallet.publicKey
    )

    const [tokenizedPositionState, tokenizedPositionBump] = await PublicKey.findProgramAddress(
      [POSITION_SEED, nftMint.toBuffer()],
      cyclosCore.programId
    )
    const vault0 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token0,
      poolState,
      true
    )

    const vault1 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token1,
      poolState,
      true
    )

    //fetch ATA of pool tokens
    const userATA0 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token0,
      wallet?.publicKey,
      true
    )
    // console.log(`user ATA 0 -> ${userATA0.toString()}`)
    const userATA1 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token1,
      wallet?.publicKey,
      true
    )

    const MaxU64 = new BN(2).pow(new BN(64)).subn(1)

    try {
      const tx = new Transaction()
      tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash
      tx.add(
        cyclosCore.instruction.decreaseLiquidity(removeLiquidityAmount, amount0Minimum, amount1Minimum, deadline, {
          accounts: {
            ownerOrDelegate: wallet?.publicKey,
            nftAccount: positionNftAccount,
            tokenizedPositionState: tokenizedPositionState,
            factoryState,
            poolState: poolState,
            corePositionState: corePositionState,
            tickLowerState: tickLowerState,
            tickUpperState: tickUpperState,
            bitmapLowerState: bitmapLowerState,
            bitmapUpperState: bitmapUpperState,
            lastObservationState,
            coreProgram: cyclosCore.programId,
          },
          remainingAccounts: [
            {
              pubkey: nextObservationState,
              isSigner: false,
              isWritable: true,
            },
          ],
        })
      )
      tx.add(
        cyclosCore.instruction.collectFromTokenized(MaxU64, MaxU64, {
          accounts: {
            ownerOrDelegate: wallet?.publicKey,
            nftAccount: positionNftAccount,
            tokenizedPositionState: tokenizedPositionState,
            factoryState,
            poolState: poolState,
            corePositionState: corePositionState,
            tickLowerState: tickLowerState,
            tickUpperState: tickUpperState,
            bitmapLowerState: bitmapLowerState,
            bitmapUpperState: bitmapUpperState,
            lastObservationState,
            coreProgram: cyclosCore.programId,
            vault0: vault0,
            vault1: vault1,
            recipientWallet0: userATA0,
            recipientWallet1: userATA1,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          remainingAccounts: [
            {
              pubkey: nextObservationState,
              isSigner: false,
              isWritable: true,
            },
          ],
        })
      )
      //  If WSOL, then close the ATA
      if (token0.toString() == NATIVE_MINT.toString() || token1.toString() == NATIVE_MINT.toString()) {
        const WSOL_ATA = await Token.getAssociatedTokenAddress(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          NATIVE_MINT,
          wallet?.publicKey
        )
        tx.add(
          Token.createCloseAccountInstruction(TOKEN_PROGRAM_ID, WSOL_ATA, wallet?.publicKey, wallet?.publicKey, [])
        )
      }
      tx.feePayer = wallet?.publicKey ?? undefined
      // await wallet?.signTransaction(tx)
      console.log(tx)
      const hash = await providerMut?.send(tx)
      console.log(hash, ' -> remove position')
      setTxnHash(hash?.signature)
      setAttemptingTxn(false)
    } catch (err: any) {
      console.log(err)
      setAttemptingTxn(false)
      enqueueSnackbar(err?.message ?? 'Something went wrong', {
        variant: 'error',
      })
      return
    }
  }

  const history = useHistory()

  const handleDismissConfirmation = useCallback(() => {
    setShowConfirm(false)
    // if there was a tx hash, we want to clear the input
    if (txnHash) {
      onPercentSelectForSlider(0)
    }
    setAttemptingTxn(false)
    setTxnHash('')
    history.push(`/pool/${tokenId}`)
  }, [onPercentSelectForSlider, txnHash])

  const pendingText = `Removing ${liquidityValue0?.toSignificant(6)} ${
    liquidityValue0?.currency?.symbol
  } and ${liquidityValue1?.toSignificant(6)} ${liquidityValue1?.currency?.symbol}`

  function modalHeader() {
    return (
      <AutoColumn gap={'sm'} style={{ padding: '16px' }}>
        <RowBetween align="flex-end">
          <Text fontSize={16} fontWeight={500}>
            <span>Pooled {liquidityValue0?.currency?.symbol}:</span>
          </Text>
          <RowFixed>
            <Text fontSize={16} fontWeight={500} marginLeft={'6px'}>
              {liquidityValue0 && <FormattedCurrencyAmount currencyAmount={liquidityValue0} />}
            </Text>
            <CurrencyLogo size="20px" style={{ marginLeft: '8px' }} currency={liquidityValue0?.currency} />
          </RowFixed>
        </RowBetween>
        <RowBetween align="flex-end">
          <Text fontSize={16} fontWeight={500}>
            <span>Pooled {liquidityValue1?.currency?.symbol}:</span>
          </Text>
          <RowFixed>
            <Text fontSize={16} fontWeight={500} marginLeft={'6px'}>
              {liquidityValue1 && <FormattedCurrencyAmount currencyAmount={liquidityValue1} />}
            </Text>
            <CurrencyLogo size="20px" style={{ marginLeft: '8px' }} currency={liquidityValue1?.currency} />
          </RowFixed>
        </RowBetween>
        {feeValue0?.greaterThan(0) || feeValue1?.greaterThan(0) ? (
          <>
            <TYPE.italic fontSize={12} color={theme.text2} textAlign="left" padding={'8px 0 0 0'}>
              <span>You will also collect fees earned from this position.</span>
            </TYPE.italic>
            <RowBetween>
              <Text fontSize={16} fontWeight={500}>
                <span>{feeValue0?.currency?.symbol} Fees Earned:</span>
              </Text>
              <RowFixed>
                <Text fontSize={16} fontWeight={500} marginLeft={'6px'}>
                  {feeValue0 && <FormattedCurrencyAmount currencyAmount={feeValue0} />}
                </Text>
                <CurrencyLogo size="20px" style={{ marginLeft: '8px' }} currency={feeValue0?.currency} />
              </RowFixed>
            </RowBetween>
            <RowBetween>
              <Text fontSize={16} fontWeight={500}>
                <span>{feeValue1?.currency?.symbol} Fees Earned:</span>
              </Text>
              <RowFixed>
                <Text fontSize={16} fontWeight={500} marginLeft={'6px'}>
                  {feeValue1 && <FormattedCurrencyAmount currencyAmount={feeValue1} />}
                </Text>
                <CurrencyLogo size="20px" style={{ marginLeft: '8px' }} currency={feeValue1?.currency} />
              </RowFixed>
            </RowBetween>
          </>
        ) : null}
        <ButtonPrimary mt="16px" onClick={OnBurn}>
          <span>Remove</span>
        </ButtonPrimary>
      </AutoColumn>
    )
  }

  return (
    <AutoColumn>
      <TransactionConfirmationModal
        isOpen={showConfirm}
        onDismiss={handleDismissConfirmation}
        attemptingTxn={attemptingTxn}
        hash={txnHash ?? ''}
        content={() => (
          <ConfirmationModalContent
            title={<span>Remove Liquidity</span>}
            onDismiss={handleDismissConfirmation}
            topContent={modalHeader}
          />
        )}
        pendingText={pendingText}
      />
      <AppBody>
        <AddRemoveTabs
          creating={false}
          adding={false}
          positionID={tokenId!.toString()}
          defaultSlippage={DEFAULT_REMOVE_V3_LIQUIDITY_SLIPPAGE_TOLERANCE}
        />
        <Wrapper>
          {position ? (
            <AutoColumn gap="lg">
              <RowBetween>
                <RowFixed>
                  <DoubleCurrencyLogo
                    currency0={feeValue0?.currency}
                    currency1={feeValue1?.currency}
                    size={20}
                    margin={true}
                  />
                  <TYPE.label
                    ml="10px"
                    fontSize="20px"
                  >{`${feeValue0?.currency?.symbol}/${feeValue1?.currency?.symbol}`}</TYPE.label>
                </RowFixed>
                <RangeBadge removed={removed} inRange={!outOfRange} />
              </RowBetween>
              <LightCard>
                <AutoColumn gap="md">
                  <TYPE.main fontWeight={400}>
                    <span>Amount</span>
                  </TYPE.main>
                  <RowBetween>
                    <ResponsiveHeaderText>
                      <span>{percentForSlider}%</span>
                    </ResponsiveHeaderText>
                    <AutoRow gap="4px" justify="flex-end">
                      <SmallMaxButton onClick={() => onPercentSelect(25)} width="20%">
                        <span>25%</span>
                      </SmallMaxButton>
                      <SmallMaxButton onClick={() => onPercentSelect(50)} width="20%">
                        <span>50%</span>
                      </SmallMaxButton>
                      <SmallMaxButton onClick={() => onPercentSelect(75)} width="20%">
                        <span>75%</span>
                      </SmallMaxButton>
                      <SmallMaxButton onClick={() => onPercentSelect(100)} width="20%">
                        <span>Max</span>
                      </SmallMaxButton>
                    </AutoRow>
                  </RowBetween>
                  <Slider value={percentForSlider} onChange={onPercentSelectForSlider} />
                </AutoColumn>
              </LightCard>
              <LightCard>
                <AutoColumn gap="md">
                  <RowBetween>
                    <Text fontSize={16} fontWeight={500}>
                      <span>Pooled {liquidityValue0?.currency?.symbol}:</span>
                    </Text>
                    <RowFixed>
                      <Text fontSize={16} fontWeight={500} marginLeft={'6px'}>
                        {liquidityValue0 && <FormattedCurrencyAmount currencyAmount={liquidityValue0} />}
                      </Text>
                      <CurrencyLogo size="20px" style={{ marginLeft: '8px' }} currency={liquidityValue0?.currency} />
                    </RowFixed>
                  </RowBetween>
                  <RowBetween>
                    <Text fontSize={16} fontWeight={500}>
                      <span>Pooled {liquidityValue1?.currency?.symbol}:</span>
                    </Text>
                    <RowFixed>
                      <Text fontSize={16} fontWeight={500} marginLeft={'6px'}>
                        {liquidityValue1 && <FormattedCurrencyAmount currencyAmount={liquidityValue1} />}
                      </Text>
                      <CurrencyLogo size="20px" style={{ marginLeft: '8px' }} currency={liquidityValue1?.currency} />
                    </RowFixed>
                  </RowBetween>
                  {feeValue0?.greaterThan(0) || feeValue1?.greaterThan(0) ? (
                    <>
                      <RowBetween>
                        <Text fontSize={16} fontWeight={500}>
                          <span>{feeValue0?.currency?.symbol} Fees Earned:</span>
                        </Text>
                        <RowFixed>
                          <Text fontSize={16} fontWeight={500} marginLeft={'6px'}>
                            {feeValue0 && <FormattedCurrencyAmount currencyAmount={feeValue0} />}
                          </Text>
                          <CurrencyLogo size="20px" style={{ marginLeft: '8px' }} currency={feeValue0?.currency} />
                        </RowFixed>
                      </RowBetween>
                      <RowBetween>
                        <Text fontSize={16} fontWeight={500}>
                          <span>{feeValue1?.currency?.symbol} Fees Earned:</span>
                        </Text>
                        <RowFixed>
                          <Text fontSize={16} fontWeight={500} marginLeft={'6px'}>
                            {feeValue1 && <FormattedCurrencyAmount currencyAmount={feeValue1} />}
                          </Text>
                          <CurrencyLogo size="20px" style={{ marginLeft: '8px' }} currency={feeValue1?.currency} />
                        </RowFixed>
                      </RowBetween>
                    </>
                  ) : null}
                </AutoColumn>
              </LightCard>
              <div style={{ display: 'flex' }}>
                <AutoColumn gap="12px" style={{ flex: '1' }}>
                  <ButtonConfirmed
                    confirmed={false}
                    disabled={removed || percent === 0 || !liquidityValue0}
                    onClick={() => setShowConfirm(true)}
                  >
                    {removed ? <span>Closed</span> : error ?? <span>Remove</span>}
                  </ButtonConfirmed>
                </AutoColumn>
              </div>
            </AutoColumn>
          ) : (
            <Loader />
          )}
        </Wrapper>
      </AppBody>
    </AutoColumn>
  )
}
