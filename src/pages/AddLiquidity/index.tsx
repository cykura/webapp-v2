import { useCallback, useContext, useMemo, useState } from 'react'
import { useWalletKit } from '@gokiprotocol/walletkit'
import { useSolana } from '@saberhq/use-solana'
import { TransactionResponse } from '@ethersproject/providers'
import { Currency, CurrencyAmount, Percent } from '@uniswap/sdk-core'
import { AlertTriangle, AlertCircle } from 'react-feather'
import ReactGA from 'react-ga'
import { ZERO_PERCENT } from '../../constants/misc'
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESSES, PROGRAM_ID_STR } from '../../constants/addresses'
import {
  BITMAP_SEED,
  FEE_SEED,
  OBSERVATION_SEED,
  POOL_SEED,
  POSITION_SEED,
  SOL_LOCAL,
  TICK_SEED,
} from '../../constants/tokens'
import { useV3NFTPositionManagerContract } from '../../hooks/useContract'
import { RouteComponentProps } from 'react-router-dom'
import { Text } from 'rebass'
import { ThemeContext } from 'styled-components/macro'
import { ButtonError, ButtonLight, ButtonPrimary, ButtonText } from '../../components/Button'
import { YellowCard, OutlineCard, BlueCard, LightCard } from '../../components/Card'
import { AutoColumn } from '../../components/Column'
import TransactionConfirmationModal, { ConfirmationModalContent } from '../../components/TransactionConfirmationModal'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import { RowBetween, RowFixed } from '../../components/Row'
import { useUSDCValue } from '../../hooks/useUSDCPrice'
import { calculateGasMargin } from '../../utils/calculateGasMargin'
import { Review } from './Review'
import { useActiveWeb3ReactSol } from '../../hooks/web3'
import { useCurrency } from '../../hooks/Tokens'
import useTransactionDeadline from '../../hooks/useTransactionDeadline'
import { Field, Bound } from '../../state/mint/v3/actions'
import { useTransactionAdder } from '../../state/transactions/hooks'
import { useIsExpertMode, useUserSlippageToleranceWithDefault } from '../../state/user/hooks'
import { TYPE, ExternalLink } from '../../theme'
import { maxAmountSpend } from '../../utils/maxAmountSpend'
import AppBody from '../AppBody'
import { currencyId } from '../../utils/currencyId'
import { DynamicSection, CurrencyDropdown, StyledInput, Wrapper, ScrollablePage } from './styled'
import { Trans, t } from '@lingui/macro'
import {
  useV3MintState,
  useV3MintActionHandlers,
  useRangeHopCallbacks,
  useV3DerivedMintInfo,
} from 'state/mint/v3/hooks'
import { FeeAmount, NonfungiblePositionManager, u32ToSeed } from '@uniswap/v3-sdk'
import { useV3PositionFromTokenId } from 'hooks/useV3Positions'
import { useDerivedPositionInfo } from 'hooks/useDerivedPositionInfo'
import { PositionPreview } from 'components/PositionPreview'
import FeeSelector from 'components/FeeSelector'
import RangeSelector from 'components/RangeSelector'
import RateToggle from 'components/RateToggle'
import { BigNumber } from '@ethersproject/bignumber'
import { AddRemoveTabs } from 'components/NavigationTabs'
import HoverInlineText from 'components/HoverInlineText'
import { SwitchLocaleLink } from 'components/SwitchLocaleLink'
import * as anchor from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
import idl from '../../constants/cyclos-core.json'
import { CyclosCore, IDL } from 'types/cyclos-core'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { u16ToSeed } from 'state/mint/v3/utils'
import { useSnackbar } from 'notistack'
import { sqrt } from '@uniswap/sdk-core'
import JSBI from 'jsbi'

const DEFAULT_ADD_IN_RANGE_SLIPPAGE_TOLERANCE = new Percent(50, 10_000)

export default function AddLiquidity({
  match: {
    params: { currencyIdA, currencyIdB, feeAmount: feeAmountFromUrl, tokenId },
  },
  history,
}: RouteComponentProps<{ currencyIdA?: string; currencyIdB?: string; feeAmount?: string; tokenId?: string }>) {
  const { account, chainId, librarySol } = useActiveWeb3ReactSol()
  const { connect } = useWalletKit()
  const { connected, wallet, connection, providerMut } = useSolana()
  const { PublicKey, SystemProgram, Transaction, SYSVAR_RENT_PUBKEY } = anchor.web3
  const { BN } = anchor

  const theme = useContext(ThemeContext)
  const { enqueueSnackbar } = useSnackbar()
  const expertMode = useIsExpertMode()
  const addTransaction = useTransactionAdder()
  const positionManager = useV3NFTPositionManagerContract()

  // check for existing position if tokenId in url
  const { position: existingPositionDetails, loading: positionLoading } = useV3PositionFromTokenId(tokenId ?? undefined)
  const hasExistingPosition = !!existingPositionDetails && !positionLoading
  const { position: existingPosition } = useDerivedPositionInfo(existingPositionDetails)

  // fee selection from url
  const feeAmount: FeeAmount | undefined =
    feeAmountFromUrl && Object.values(FeeAmount).includes(parseFloat(feeAmountFromUrl))
      ? parseFloat(feeAmountFromUrl)
      : undefined

  const currencyA = useCurrency(currencyIdA)
  const currencyB = useCurrency(currencyIdB)

  // keep track for UI display purposes of user selected base currency
  const baseCurrency = currencyA
  const quoteCurrency = useMemo(
    () =>
      currencyA && currencyB && baseCurrency ? (baseCurrency.equals(currencyA) ? currencyB : currencyA) : undefined,
    [currencyA, currencyB, baseCurrency]
  )

  // mint state
  const { independentField, typedValue, startPriceTypedValue } = useV3MintState()

  const {
    pool,
    ticks,
    dependentField,
    price,
    pricesAtTicks,
    parsedAmounts,
    currencyBalances,
    position,
    noLiquidity,
    currencies,
    errorMessage,
    invalidPool,
    invalidRange,
    outOfRange,
    depositADisabled,
    depositBDisabled,
    invertPrice,
  } = useV3DerivedMintInfo(
    currencyA ?? undefined,
    currencyB ?? undefined,
    feeAmount,
    baseCurrency ?? undefined,
    existingPosition
  )

  const { onFieldAInput, onFieldBInput, onLeftRangeInput, onRightRangeInput, onStartPriceInput } =
    useV3MintActionHandlers(noLiquidity)

  const isValid = !errorMessage && !invalidRange

  // modal and loading
  const [showConfirm, setShowConfirm] = useState<boolean>(false)
  const [attemptingTxn, setAttemptingTxn] = useState<boolean>(false) // clicked confirm

  // txn values
  // const deadline = useTransactionDeadline() // custom from users settings

  const [txHash, setTxHash] = useState<string>('')

  // get formatted amounts
  const formattedAmounts = {
    [independentField]: typedValue,
    [dependentField]: parsedAmounts[dependentField]?.toSignificant(6) ?? '',
  }

  const usdcValues = {
    [Field.CURRENCY_A]: useUSDCValue(parsedAmounts[Field.CURRENCY_A]),
    [Field.CURRENCY_B]: useUSDCValue(parsedAmounts[Field.CURRENCY_B]),
  }

  // get the max amounts user can add
  const maxAmounts: { [field in Field]?: CurrencyAmount<Currency> } = [Field.CURRENCY_A, Field.CURRENCY_B].reduce(
    (accumulator, field) => {
      return {
        ...accumulator,
        [field]: maxAmountSpend(currencyBalances[field]),
      }
    },
    {}
  )

  const atMaxAmounts: { [field in Field]?: CurrencyAmount<Currency> } = [Field.CURRENCY_A, Field.CURRENCY_B].reduce(
    (accumulator, field) => {
      return {
        ...accumulator,
        [field]: maxAmounts[field]?.equalTo(parsedAmounts[field] ?? '0'),
      }
    },
    {}
  )

  const allowedSlippage = useUserSlippageToleranceWithDefault(
    outOfRange ? ZERO_PERCENT : DEFAULT_ADD_IN_RANGE_SLIPPAGE_TOLERANCE
  )

  // get value and prices at ticks
  const { [Bound.LOWER]: tickLower, [Bound.UPPER]: tickUpper } = ticks
  const { [Bound.LOWER]: priceLower, [Bound.UPPER]: priceUpper } = pricesAtTicks
  // console.log(priceLower?.toSignificant())
  // console.log(priceUpper?.toSignificant())

  // console.log(+formattedAmounts[Field.CURRENCY_A])
  // console.log(+formattedAmounts[Field.CURRENCY_B])
  async function OnAdd() {
    if (!wallet?.publicKey || !currencyA?.wrapped.address || !currencyB?.wrapped.address) return

    const provider = new anchor.Provider(connection, wallet as Wallet, {
      skipPreflight: false,
    })
    const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)

    const fee = feeAmount ?? 500
    const tickSpacing = fee / 50

    // Convinence helpers
    const tokenA = currencyA?.wrapped
    const tokenB = currencyB?.wrapped
    const [tk1, tk2] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]

    const newInvertPrice = Boolean(tokenA && tk1 && !tokenA.equals(tk1))

    console.log(
      `POOL CREATION\ntokenA ${tokenA?.symbol}\ntokenB ${tokenB?.symbol}\ntoken1 ${tk1?.symbol}\ntoken2 ${tk2?.symbol}\ninvertPrice ${invertPrice}\nnew invert price ${newInvertPrice}`
    )

    const token1 = new anchor.web3.PublicKey(tk1.address)
    const token2 = new anchor.web3.PublicKey(tk2.address)

    // create fee state
    const [feeState, feeStateBump] = await anchor.web3.PublicKey.findProgramAddress(
      [FEE_SEED, u32ToSeed(fee)],
      cyclosCore.programId
    )
    // console.log(`feeState -> ${feeState.toString()}`)
    // create pool state
    const [poolState, poolStateBump] = await PublicKey.findProgramAddress(
      [POOL_SEED, token1.toBuffer(), token2.toBuffer(), u32ToSeed(fee)],
      cyclosCore.programId
    )
    // console.log(`poolState -> ${poolState.toString()}`)

    // create init Observation state
    const [initialObservationState, initialObservationBump] = await PublicKey.findProgramAddress(
      [OBSERVATION_SEED, token1.toBuffer(), token2.toBuffer(), u32ToSeed(fee), u16ToSeed(0)],
      cyclosCore.programId
    )
    // console.log(`initialObservationState -> ${initialObservationState.toString()}`)

    // get init Price from UI - should encode into Q32.32
    // taken from test file
    // const initPrice = new BN((+startPriceTypedValue * Math.pow(2, 32)).toFixed(0))
    const sqrtPriceX32 = new BN(
      sqrt(
        JSBI.BigInt(new BN(startPriceTypedValue).shln(64).muln(Math.pow(10, tk1?.decimals - tk2?.decimals)))
      ).toString()
    )
    console.log('sqrtpricex32 -> ', sqrtPriceX32.toString())

    // taken as contants in test file
    let tickLower = ticks.LOWER ?? 0
    let tickUpper = ticks.UPPER ?? 10
    // flipping ticks according to token sorted order
    if (!invertPrice && tickUpper && tickLower) {
      console.log('Invert Price is true and hence we flip ticks?')
      ;[tickLower, tickUpper] = [tickLower, tickUpper]
      // console.log(`tickLower is ${tickLower} and tickUpper is ${tickUpper}`)
    } else {
      console.log('Invert Price is false and hence we negate ticks?')
      ;[tickLower, tickUpper] = [-tickUpper, -tickLower]
    }
    // tickLower should be less than tickUpper
    ;[tickLower, tickUpper] = tickLower < tickUpper ? [tickLower, tickUpper] : [tickUpper, tickLower]
    console.log('Creating position with tick Lower ', tickLower, 'tick Upper ', tickUpper)
    // const tickLower = 0
    // const tickUpper = 10 % tickSpacing == 0 ? 10 : tickSpacing * 1
    const wordPosLower = (tickLower / tickSpacing) >> 8
    const wordPosUpper = (tickUpper / tickSpacing) >> 8
    // console.log(tickLower, tickUpper, wordPosLower, wordPosUpper)

    //fetch ATA of pool tokens
    const vault1 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token2,
      poolState,
      true
    )
    // console.log(`vault1 -> ${vault1.toString()}`)
    const vault0 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token1,
      poolState,
      true
    )
    // console.log(`vault0 -> ${vault0.toString()}`)

    //fetch ATA of pool tokens
    const userATA0 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token1,
      wallet?.publicKey,
      true
    )
    // console.log(`user ATA 0 -> ${userATA0.toString()}`)
    const userATA1 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token2,
      wallet?.publicKey,
      true
    )
    // console.log(`user ATA 1 -> ${userATA1.toString()}`)

    // If pool not exist, create and init pool and create tick and bitmap tokens accounts
    //  this can be checked using `noLiquidity`

    // Create and init pool
    if (noLiquidity) {
      console.log('Creating and init pool')
      try {
        const createHash = await cyclosCore.rpc.createAndInitPool(poolStateBump, initialObservationBump, sqrtPriceX32, {
          accounts: {
            poolCreator: wallet?.publicKey,
            token0: token1,
            token1: token2,
            feeState,
            poolState,
            initialObservationState,
            vault0,
            vault1,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          },
        })
        const pState = await cyclosCore.account.poolState.fetch(poolState)
        console.log(pState)
        console.log('Position created with tick', pState.tick.toString())
        console.log('Position created with price', pState.sqrtPriceX32.toString())
        console.log(createHash, ' txn hash for create Pool')
        enqueueSnackbar('Pool Created', {
          variant: 'success',
        })
      } catch (err: any) {
        enqueueSnackbar(err?.message ?? 'Something went wrong', {
          variant: 'error',
        })
        return
      }
    }
    // Create tick and bitmap accounts
    const [tickLowerState, tickLowerStateBump] = await PublicKey.findProgramAddress(
      [TICK_SEED, token1.toBuffer(), token2.toBuffer(), u32ToSeed(fee), u32ToSeed(tickLower)],
      cyclosCore.programId
    )
    // console.log(tickLowerState.toString(), ' tick lower state')

    const [tickUpperState, tickUpperStateBump] = await PublicKey.findProgramAddress(
      [TICK_SEED, token1.toBuffer(), token2.toBuffer(), u32ToSeed(fee), u32ToSeed(tickUpper)],
      cyclosCore.programId
    )
    // console.log(tickUpperState.toString(), ' tick upper state')

    const [bitmapLowerState, bitmapLowerBump] = await PublicKey.findProgramAddress(
      [BITMAP_SEED, token1.toBuffer(), token2.toBuffer(), u32ToSeed(fee), u16ToSeed(wordPosLower)],
      cyclosCore.programId
    )
    // console.log(bitmapLowerState.toString(), ' bitmap lower state')
    const [bitmapUpperState, bitmapUpperBump] = await PublicKey.findProgramAddress(
      [BITMAP_SEED, token1.toBuffer(), token2.toBuffer(), u32ToSeed(fee), u16ToSeed(wordPosUpper)],
      cyclosCore.programId
    )
    // console.log(bitmapUpperState.toString(), ' bitmap upper state')

    const [factoryState, factoryStateBump] = await PublicKey.findProgramAddress([], cyclosCore.programId)
    // console.log(factoryState.toString(), ' factory State')

    const [corePositionState, corePositionBump] = await PublicKey.findProgramAddress(
      [
        POSITION_SEED,
        token1.toBuffer(),
        token2.toBuffer(),
        u32ToSeed(fee),
        factoryState.toBuffer(),
        u32ToSeed(tickLower),
        u32ToSeed(tickUpper),
      ],
      cyclosCore.programId
    )
    // console.log(corePositionState.toString(), ' core position State')

    const tickLowerStateInfo = await connection.getAccountInfo(tickLowerState)
    const tickUpperStateInfo = await connection.getAccountInfo(tickUpperState)
    const bitmapLowerStateInfo = await connection.getAccountInfo(bitmapLowerState)
    const bitmapUpperStateInfo = await connection.getAccountInfo(bitmapUpperState)
    const corePositionStateInfo = await connection.getAccountInfo(corePositionState)

    console.log(
      tickLowerStateInfo,
      tickUpperStateInfo,
      bitmapLowerStateInfo,
      bitmapUpperStateInfo,
      corePositionStateInfo
    )

    // Build the transaction
    if (
      !corePositionStateInfo ||
      !tickLowerStateInfo ||
      !tickUpperStateInfo ||
      !bitmapLowerStateInfo ||
      !bitmapUpperStateInfo
    ) {
      console.log('Creating accounts')
      try {
        const tx = new Transaction()
        tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash
        if (!tickLowerStateInfo) {
          console.log('Creating tickLowerState')
          tx.instructions.push(
            cyclosCore.instruction.initTickAccount(tickLowerStateBump, tickLower, {
              accounts: {
                signer: wallet?.publicKey,
                poolState: poolState,
                tickState: tickLowerState,
                systemProgram: SystemProgram.programId,
              },
            })
          )
        }
        if (!tickUpperStateInfo) {
          console.log('Creating tickUpperState')
          tx.instructions.push(
            cyclosCore.instruction.initTickAccount(tickUpperStateBump, tickUpper, {
              accounts: {
                signer: wallet?.publicKey,
                poolState: poolState,
                tickState: tickUpperState,
                systemProgram: SystemProgram.programId,
              },
            })
          )
        }
        if (!bitmapLowerStateInfo) {
          console.log('Creating tickbitMapLowerState')
          tx.instructions.push(
            cyclosCore.instruction.initBitmapAccount(bitmapLowerBump, wordPosLower, {
              accounts: {
                signer: wallet?.publicKey,
                poolState: poolState,
                bitmapState: bitmapLowerState,
                systemProgram: SystemProgram.programId,
              },
            })
          )
        }
        if (bitmapLowerState.toString() !== bitmapUpperState.toString()) {
          console.log('Creating tickbitMapUpperState')
          tx.instructions.push(
            cyclosCore.instruction.initBitmapAccount(bitmapUpperBump, wordPosUpper, {
              accounts: {
                signer: wallet?.publicKey,
                poolState: poolState,
                bitmapState: bitmapUpperState,
                systemProgram: SystemProgram.programId,
              },
            })
          )
        }
        if (!corePositionStateInfo) {
          console.log('Creating core Position')
          tx.instructions.push(
            cyclosCore.instruction.initPositionAccount(corePositionBump, {
              accounts: {
                signer: wallet?.publicKey,
                recipient: factoryState,
                poolState: poolState,
                tickLowerState: tickLowerState,
                tickUpperState: tickUpperState,
                positionState: corePositionState,
                systemProgram: SystemProgram.programId,
              },
            })
          )
        }
        tx.feePayer = wallet?.publicKey ?? undefined
        await wallet?.signTransaction(tx)
        const hash = await providerMut?.send(tx)
        console.log(hash, ' -> create account hash')
      } catch (err: any) {
        enqueueSnackbar(err?.message ?? 'Something went wrong', {
          variant: 'error',
        })
        return
      }
    }

    // Then finally mint the required position
    // Need to fix this wallet.publicKey is undefined
    const nftMintKeypair = new anchor.web3.Keypair()

    const [tokenizedPositionState, tokenizedPositionBump] = await PublicKey.findProgramAddress(
      [POSITION_SEED, nftMintKeypair.publicKey.toBuffer()],
      cyclosCore.programId
    )

    const positionNftAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      nftMintKeypair.publicKey,
      wallet.publicKey
    )

    // const amount0Desired = new BN(1_000_000)
    // const amount1Desired = new BN(1_000_000)
    const amount0Desired = new BN(
      +formattedAmounts[Field.CURRENCY_A] * Math.pow(10, currencies[Field.CURRENCY_A]?.decimals ?? 0)
    )
    const amount1Desired = new BN(
      +formattedAmounts[Field.CURRENCY_B] * Math.pow(10, currencies[Field.CURRENCY_B]?.decimals ?? 0)
    )
    console.log(amount0Desired.toString(), amount1Desired.toString())
    const amount0Minimum = new BN(0)
    const amount1Minimum = new BN(0)
    const deadline = new BN(Date.now() / 1000 + 10_000)

    // fetch observation accounts
    const { observationIndex, observationCardinalityNext } = await cyclosCore.account.poolState.fetch(poolState)

    const latestObservationState = (
      await PublicKey.findProgramAddress(
        [OBSERVATION_SEED, token1.toBuffer(), token2.toBuffer(), u32ToSeed(fee), u16ToSeed(observationIndex)],
        cyclosCore.programId
      )
    )[0]

    const nextObservationState = (
      await PublicKey.findProgramAddress(
        [
          OBSERVATION_SEED,
          token1.toBuffer(),
          token2.toBuffer(),
          u32ToSeed(fee),
          u16ToSeed((observationIndex + 1) % observationCardinalityNext),
        ],
        cyclosCore.programId
      )
    )[0]

    if (noLiquidity || !existingPosition) {
      console.log(
        tickLowerState.toString(),
        tickUpperState.toString(),
        bitmapLowerState.toString(),
        bitmapUpperState.toString(),
        corePositionState.toString()
      )
      // Create new position
      console.log('Creating new position')
      try {
        const txnHash = await cyclosCore.rpc.mintTokenizedPosition(
          tokenizedPositionBump,
          amount0Desired,
          amount1Desired,
          amount0Minimum,
          amount1Minimum,
          deadline,
          {
            accounts: {
              minter: wallet?.publicKey,
              recipient: wallet?.publicKey,
              factoryState,
              nftMint: nftMintKeypair.publicKey,
              nftAccount: positionNftAccount,
              poolState: poolState,
              corePositionState: corePositionState,
              tickLowerState: tickLowerState,
              tickUpperState: tickUpperState,
              bitmapLowerState: bitmapLowerState,
              bitmapUpperState: bitmapUpperState,
              tokenAccount0: userATA0,
              tokenAccount1: userATA1,
              vault0: vault0,
              vault1: vault1,
              latestObservationState: latestObservationState,
              nextObservationState: nextObservationState,
              tokenizedPositionState: tokenizedPositionState,
              coreProgram: cyclosCore.programId,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            },
            signers: [nftMintKeypair],
          }
        )
        const tokenizedPositionData = await cyclosCore.account.tokenizedPositionState.fetch(tokenizedPositionState)
        console.log(tokenizedPositionData)
        setTxHash(txnHash)
      } catch (err: any) {
        console.log(err)
        enqueueSnackbar(err?.message ?? 'Something went wrong', {
          variant: 'error',
        })
        return
      }
    } else {
      // Increase Liquidity
      console.log('Increasing Liquidity to existing position')
      try {
        // handle for tokenID is undefined
        const [nftMint, _] = await PublicKey.findProgramAddress(
          [POSITION_SEED, new PublicKey(tokenId!).toBuffer()],
          cyclosCore.programId
        )

        // refetch observation accounts
        // for large time differences the oracle value can become stale
        const { observationIndex, observationCardinalityNext } = await cyclosCore.account.poolState.fetch(poolState)

        const latestObservationState = (
          await PublicKey.findProgramAddress(
            [OBSERVATION_SEED, token1.toBuffer(), token2.toBuffer(), u32ToSeed(fee), u16ToSeed(observationIndex)],
            cyclosCore.programId
          )
        )[0]

        const nextObservationState = (
          await PublicKey.findProgramAddress(
            [
              OBSERVATION_SEED,
              token1.toBuffer(),
              token2.toBuffer(),
              u32ToSeed(fee),
              u16ToSeed((observationIndex + 1) % observationCardinalityNext),
            ],
            cyclosCore.programId
          )
        )[0]

        const hashRes = await cyclosCore.rpc.increaseLiquidity(
          amount0Desired,
          amount1Desired,
          amount0Minimum,
          amount1Minimum,
          deadline,
          {
            accounts: {
              payer: wallet?.publicKey,
              factoryState,
              poolState: poolState,
              corePositionState: corePositionState,
              tickLowerState: tickLowerState,
              tickUpperState: tickUpperState,
              bitmapLowerState: bitmapLowerState,
              bitmapUpperState: bitmapUpperState,
              tokenAccount0: userATA0,
              tokenAccount1: userATA1,
              vault0: vault0,
              vault1: vault1,
              latestObservationState: latestObservationState,
              nextObservationState: nextObservationState,
              tokenizedPositionState: nftMint,
              coreProgram: cyclosCore.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
            },
          }
        )
        console.log(hashRes)
        setTxHash(hashRes)
      } catch (err: any) {
        console.log(err)
        enqueueSnackbar(err?.message ?? 'Something went wrong', {
          variant: 'error',
        })
        return
      }
    }
  }

  const pendingText = `Supplying ${!depositADisabled ? parsedAmounts[Field.CURRENCY_A]?.toSignificant(6) : ''} ${
    !depositADisabled ? currencies[Field.CURRENCY_A]?.symbol : ''
  } ${!outOfRange ? 'and' : ''} ${!depositBDisabled ? parsedAmounts[Field.CURRENCY_B]?.toSignificant(6) : ''} ${
    !depositBDisabled ? currencies[Field.CURRENCY_B]?.symbol : ''
  }`

  const handleCurrencySelect = useCallback(
    (currencyNew: Currency, currencyIdOther?: string): (string | undefined)[] => {
      const currencyIdNew = currencyId(currencyNew)

      if (currencyIdNew === currencyIdOther) {
        // not ideal, but for now clobber the other if the currency ids are equal
        return [currencyIdNew, undefined]
      } else {
        // prevent weth + eth
        const isETHOrWETHNew =
          currencyIdNew === 'wSOL' || (chainId !== undefined && currencyIdNew === SOL_LOCAL.address)
        const isETHOrWETHOther =
          currencyIdOther !== undefined &&
          (currencyIdOther === 'wSOL' || (chainId !== undefined && currencyIdOther === SOL_LOCAL.address))

        if (isETHOrWETHNew && isETHOrWETHOther) {
          return [currencyIdNew, undefined]
        } else {
          return [currencyIdNew, currencyIdOther]
        }
      }
    },
    [chainId]
  )

  const handleCurrencyASelect = useCallback(
    (currencyANew: Currency) => {
      const [idA, idB] = handleCurrencySelect(currencyANew, currencyIdB)
      if (idB === undefined) {
        history.push(`/add/${idA}`)
      } else {
        history.push(`/add/${idA}/${idB}`)
      }
    },
    [handleCurrencySelect, currencyIdB, history]
  )

  const handleCurrencyBSelect = useCallback(
    (currencyBNew: Currency) => {
      const [idB, idA] = handleCurrencySelect(currencyBNew, currencyIdA)
      if (idA === undefined) {
        history.push(`/add/${idB}`)
      } else {
        history.push(`/add/${idA}/${idB}`)
      }
    },
    [handleCurrencySelect, currencyIdA, history]
  )

  const handleFeePoolSelect = useCallback(
    (newFeeAmount: FeeAmount) => {
      history.push(`/add/${currencyIdA}/${currencyIdB}/${newFeeAmount}`)
    },
    [currencyIdA, currencyIdB, history]
  )

  const handleDismissConfirmation = useCallback(() => {
    setShowConfirm(false)
    // if there was a tx hash, we want to clear the input
    if (txHash) {
      onFieldAInput('')
      history.push('/pool')
    }
    setTxHash('')
  }, [history, onFieldAInput, txHash])

  const clearAll = useCallback(() => {
    onFieldAInput('')
    onFieldBInput('')
    onLeftRangeInput('')
    onRightRangeInput('')
    history.push(`/add`)
  }, [history, onFieldAInput, onFieldBInput, onLeftRangeInput, onRightRangeInput])

  const { getDecrementLower, getIncrementLower, getDecrementUpper, getIncrementUpper } = useRangeHopCallbacks(
    baseCurrency ?? undefined,
    quoteCurrency ?? undefined,
    feeAmount,
    tickLower,
    tickUpper,
    pool
  )

  return (
    <>
      <ScrollablePage>
        <TransactionConfirmationModal
          isOpen={showConfirm}
          onDismiss={handleDismissConfirmation}
          attemptingTxn={attemptingTxn}
          hash={txHash}
          content={() => (
            <ConfirmationModalContent
              title={'Add Liquidity'}
              onDismiss={handleDismissConfirmation}
              topContent={() => (
                <Review
                  parsedAmounts={parsedAmounts}
                  position={position}
                  existingPosition={existingPosition}
                  priceLower={priceLower}
                  priceUpper={priceUpper}
                  outOfRange={outOfRange}
                />
              )}
              bottomContent={() => (
                <ButtonPrimary style={{ marginTop: '1rem' }} onClick={OnAdd}>
                  <Text fontWeight={500} fontSize={20}>
                    <Trans>Add</Trans>
                  </Text>
                </ButtonPrimary>
              )}
            />
          )}
          pendingText={pendingText}
        />
        <AppBody>
          <AddRemoveTabs
            creating={false}
            adding={true}
            positionID={tokenId}
            defaultSlippage={DEFAULT_ADD_IN_RANGE_SLIPPAGE_TOLERANCE}
          />
          <Wrapper>
            <AutoColumn gap="32px">
              {!hasExistingPosition && (
                <>
                  <AutoColumn gap="md">
                    <RowBetween paddingBottom="20px">
                      <TYPE.label>
                        <Trans>Select pair</Trans>
                      </TYPE.label>
                      <ButtonText onClick={clearAll}>
                        <TYPE.blue fontSize="12px">
                          <Trans>Clear All</Trans>
                        </TYPE.blue>
                      </ButtonText>
                    </RowBetween>
                    <RowBetween>
                      <CurrencyDropdown
                        value={formattedAmounts[Field.CURRENCY_A]}
                        onUserInput={onFieldAInput}
                        hideInput={true}
                        onMax={() => {
                          onFieldAInput(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')
                        }}
                        onCurrencySelect={handleCurrencyASelect}
                        showMaxButton={!atMaxAmounts[Field.CURRENCY_A]}
                        currency={currencies[Field.CURRENCY_A]}
                        id="add-liquidity-input-tokena"
                        showCommonBases
                      />
                      <div style={{ width: '12px' }} />

                      <CurrencyDropdown
                        value={formattedAmounts[Field.CURRENCY_B]}
                        hideInput={true}
                        onUserInput={onFieldBInput}
                        onCurrencySelect={handleCurrencyBSelect}
                        onMax={() => {
                          onFieldBInput(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')
                        }}
                        showMaxButton={!atMaxAmounts[Field.CURRENCY_B]}
                        currency={currencies[Field.CURRENCY_B]}
                        id="add-liquidity-input-tokenb"
                        showCommonBases
                      />
                    </RowBetween>

                    <FeeSelector
                      disabled={!currencyB || !currencyA}
                      feeAmount={feeAmount}
                      handleFeePoolSelect={handleFeePoolSelect}
                      token0={currencyA?.wrapped}
                      token1={currencyB?.wrapped}
                    />
                  </AutoColumn>{' '}
                </>
              )}

              {hasExistingPosition && existingPosition ? (
                <PositionPreview
                  position={existingPosition}
                  title={<Trans>Selected Range</Trans>}
                  inRange={!outOfRange}
                />
              ) : (
                <>
                  {noLiquidity && (
                    <DynamicSection disabled={!currencyA || !currencyB}>
                      <AutoColumn gap="md">
                        <RowBetween>
                          <TYPE.label>
                            <Trans>Set Starting Price</Trans>
                          </TYPE.label>
                          {baseCurrency && quoteCurrency ? (
                            <RateToggle
                              currencyA={baseCurrency}
                              currencyB={quoteCurrency}
                              handleRateToggle={() => {
                                onLeftRangeInput('')
                                onRightRangeInput('')
                                history.push(
                                  `/add/${currencyIdB as string}/${currencyIdA as string}${
                                    feeAmount ? '/' + feeAmount : ''
                                  }`
                                )
                              }}
                            />
                          ) : null}
                        </RowBetween>

                        <OutlineCard padding="12px">
                          <StyledInput
                            className="start-price-input"
                            value={startPriceTypedValue}
                            onUserInput={onStartPriceInput}
                          />
                        </OutlineCard>
                        <RowBetween style={{ backgroundColor: theme.bg1, padding: '12px', borderRadius: '12px' }}>
                          <TYPE.main>
                            <Trans>Current {baseCurrency?.symbol} Price:</Trans>
                          </TYPE.main>
                          <TYPE.main>
                            {price ? (
                              <TYPE.main>
                                <RowFixed>
                                  <HoverInlineText
                                    maxCharacters={20}
                                    text={invertPrice ? price?.invert()?.toSignificant(5) : price?.toSignificant(5)}
                                  />{' '}
                                  <span style={{ marginLeft: '4px' }}>{quoteCurrency?.symbol}</span>
                                </RowFixed>
                              </TYPE.main>
                            ) : (
                              '-'
                            )}
                          </TYPE.main>
                        </RowBetween>
                        <BlueCard
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: ' 1.5rem 1.25rem',
                          }}
                        >
                          <AlertCircle color={theme.text1} size={32} style={{ marginBottom: '12px', opacity: 0.8 }} />
                          <TYPE.body
                            fontSize={14}
                            style={{ marginBottom: 8, fontWeight: 500, opacity: 0.8 }}
                            textAlign="center"
                          >
                            You are the first liquidity provider for this Uniswap V3 pool.
                          </TYPE.body>

                          <TYPE.body fontWeight={500} textAlign="center" fontSize={14} style={{ opacity: 0.8 }}>
                            The transaction cost will be much higher as it includes the gas to create the pool.
                          </TYPE.body>
                        </BlueCard>
                      </AutoColumn>
                    </DynamicSection>
                  )}

                  <DynamicSection
                    gap="md"
                    disabled={!feeAmount || invalidPool || (noLiquidity && !startPriceTypedValue)}
                  >
                    <RowBetween>
                      <TYPE.label>
                        <Trans>Set Price Range</Trans>
                      </TYPE.label>

                      {baseCurrency && quoteCurrency ? (
                        <RateToggle
                          currencyA={baseCurrency}
                          currencyB={quoteCurrency}
                          handleRateToggle={() => {
                            onLeftRangeInput('')
                            onRightRangeInput('')
                            history.push(
                              `/add/${currencyIdB as string}/${currencyIdA as string}${
                                feeAmount ? '/' + feeAmount : ''
                              }`
                            )
                          }}
                        />
                      ) : null}
                    </RowBetween>
                    <TYPE.main fontSize={14} fontWeight={400} style={{ marginBottom: '.5rem', lineHeight: '125%' }}>
                      <Trans>
                        Your liquidity will only earn fees when the market price of the pair is within your range.{' '}
                        <ExternalLink
                          href={'https://docs.uniswap.org/concepts/introduction/liquidity-user-guide#4-set-price-range'}
                          style={{ fontSize: '14px' }}
                        >
                          Need help picking a range?
                        </ExternalLink>
                      </Trans>
                    </TYPE.main>

                    <RangeSelector
                      priceLower={priceLower}
                      priceUpper={priceUpper}
                      getDecrementLower={getDecrementLower}
                      getIncrementLower={getIncrementLower}
                      getDecrementUpper={getDecrementUpper}
                      getIncrementUpper={getIncrementUpper}
                      onLeftRangeInput={onLeftRangeInput}
                      onRightRangeInput={onRightRangeInput}
                      currencyA={baseCurrency}
                      currencyB={quoteCurrency}
                      feeAmount={feeAmount}
                    />

                    {price && baseCurrency && quoteCurrency && !noLiquidity && (
                      <LightCard style={{ padding: '12px' }}>
                        <AutoColumn gap="4px">
                          <TYPE.main fontWeight={500} textAlign="center" fontSize={12}>
                            <Trans>Current Price</Trans>
                          </TYPE.main>
                          <TYPE.body fontWeight={500} textAlign="center" fontSize={20}>
                            <HoverInlineText
                              maxCharacters={20}
                              text={invertPrice ? price.invert().toSignificant(6) : price.toSignificant(6)}
                            />{' '}
                          </TYPE.body>
                          <TYPE.main fontWeight={500} textAlign="center" fontSize={12}>
                            <Trans>
                              {quoteCurrency?.symbol} per {baseCurrency.symbol}
                            </Trans>
                          </TYPE.main>
                        </AutoColumn>
                      </LightCard>
                    )}

                    {outOfRange ? (
                      <YellowCard padding="8px 12px" $borderRadius="12px">
                        <RowBetween>
                          <AlertTriangle stroke={theme.yellow3} size="16px" />
                          <TYPE.yellow ml="12px" fontSize="12px">
                            <Trans>
                              Your position will not earn fees or be used in trades until the market price moves into
                              your range.
                            </Trans>
                          </TYPE.yellow>
                        </RowBetween>
                      </YellowCard>
                    ) : null}

                    {invalidRange ? (
                      <YellowCard padding="8px 12px" $borderRadius="12px">
                        <RowBetween>
                          <AlertTriangle stroke={theme.yellow3} size="16px" />
                          <TYPE.yellow ml="12px" fontSize="12px">
                            <Trans>Invalid range selected. The min price must be lower than the max price.</Trans>
                          </TYPE.yellow>
                        </RowBetween>
                      </YellowCard>
                    ) : null}
                  </DynamicSection>
                </>
              )}

              <DynamicSection
                disabled={tickLower === undefined || tickUpper === undefined || invalidPool || invalidRange}
              >
                <AutoColumn gap="md">
                  <TYPE.label>{hasExistingPosition ? 'Add more liquidity' : t`Deposit Amounts`}</TYPE.label>

                  <CurrencyInputPanel
                    value={formattedAmounts[Field.CURRENCY_A]}
                    onUserInput={onFieldAInput}
                    onMax={() => {
                      onFieldAInput(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')
                    }}
                    showMaxButton={!atMaxAmounts[Field.CURRENCY_A]}
                    currency={currencies[Field.CURRENCY_A]}
                    id="add-liquidity-input-tokena"
                    fiatValue={usdcValues[Field.CURRENCY_A]}
                    showCommonBases
                    locked={depositADisabled}
                  />

                  <CurrencyInputPanel
                    value={formattedAmounts[Field.CURRENCY_B]}
                    onUserInput={onFieldBInput}
                    onMax={() => {
                      onFieldBInput(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')
                    }}
                    showMaxButton={!atMaxAmounts[Field.CURRENCY_B]}
                    fiatValue={usdcValues[Field.CURRENCY_B]}
                    currency={currencies[Field.CURRENCY_B]}
                    id="add-liquidity-input-tokenb"
                    showCommonBases
                    locked={depositBDisabled}
                  />
                </AutoColumn>
              </DynamicSection>
              <div>
                {!connected ? (
                  <ButtonLight onClick={connect} $borderRadius="12px" padding={'12px'}>
                    <Trans>Connect wallet</Trans>
                  </ButtonLight>
                ) : (
                  <AutoColumn gap={'md'}>
                    <ButtonError
                      onClick={() => {
                        expertMode ? OnAdd() : setShowConfirm(true)
                      }}
                      disabled={!isValid}
                      error={!isValid && !!parsedAmounts[Field.CURRENCY_A] && !!parsedAmounts[Field.CURRENCY_B]}
                    >
                      <Text fontWeight={500}>{errorMessage ? errorMessage : <Trans>Add</Trans>}</Text>
                    </ButtonError>
                  </AutoColumn>
                )}
              </div>
            </AutoColumn>
          </Wrapper>
        </AppBody>
      </ScrollablePage>
      <SwitchLocaleLink />
    </>
  )
}
