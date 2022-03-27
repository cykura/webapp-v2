import { useCallback, useContext, useMemo, useState } from 'react'
import { useWalletKit } from '@gokiprotocol/walletkit'
import { useSolana } from '@saberhq/use-solana'
import { Currency, CurrencyAmount, Percent } from '@cykura/sdk-core'
import { TICK_SPACINGS } from '@cykura/sdk'
import { AlertTriangle, AlertCircle } from 'react-feather'
import { ZERO_PERCENT } from '../../constants/misc'
import { PROGRAM_ID_STR } from '../../constants/addresses'
import {
  BITMAP_SEED,
  FEE_SEED,
  OBSERVATION_SEED,
  POOL_SEED,
  POSITION_SEED,
  SOLCYS_LOCAL,
  TICK_SEED,
  METADATA_SEED,
  WSOL_LOCAL,
  WSOL_MAIN,
} from '../../constants/tokens'
import { RouteComponentProps } from 'react-router-dom'
import { Text } from 'rebass'
import { ThemeContext } from 'styled-components/macro'
import { ButtonError, ButtonLight, ButtonPrimary, ButtonText } from '../../components/Button'
import { YellowCard, OutlineCard, BlueCard, LightCard } from '../../components/Card'
import { AutoColumn } from '../../components/Column'
import TransactionConfirmationModal, { ConfirmationModalContent } from '../../components/TransactionConfirmationModal'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import { RowBetween, RowFixed } from '../../components/Row'
import { useUSDTValue } from '../../hooks/useUSDTPrice'
import { Review } from './Review'
import { useActiveWeb3ReactSol } from '../../hooks/web3'
import { useCurrency } from '../../hooks/Tokens'
import { Field, Bound } from '../../state/mint/v3/actions'
import { useIsExpertMode, useUserSlippageToleranceWithDefault } from '../../state/user/hooks'
import { TYPE } from '../../theme'
import { maxAmountSpend } from '../../utils/maxAmountSpend'
import AppBody from '../AppBody'
import { currencyId } from '../../utils/currencyId'
import { DynamicSection, CurrencyDropdown, StyledInput, Wrapper, ScrollablePage } from './styled'
import {
  useV3MintState,
  useV3MintActionHandlers,
  useRangeHopCallbacks,
  useV3DerivedMintInfo,
} from 'state/mint/v3/hooks'
import { encodeSqrtRatioX32, FeeAmount, u32ToSeed } from '@cykura/sdk'
import { useV3PositionFromTokenId } from 'hooks/useV3Positions'
import { useDerivedPositionInfo } from 'hooks/useDerivedPositionInfo'
import { PositionPreview } from 'components/PositionPreview'
import FeeSelector from 'components/FeeSelector'
import RangeSelector from 'components/RangeSelector'
import RateToggle from 'components/RateToggle'
import { AddRemoveTabs } from 'components/NavigationTabs'
import HoverInlineText from 'components/HoverInlineText'
import { SwitchLocaleLink } from 'components/SwitchLocaleLink'
import * as anchor from '@project-serum/anchor'
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT } from '@solana/spl-token'
import { CyclosCore, IDL } from 'types/cyclos-core'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { u16ToSeed } from 'state/mint/v3/utils'
import { useSnackbar } from 'notistack'
import * as metaplex from '@metaplex/js'
import { TransactionInstruction } from '@solana/web3.js'
import JSBI from 'jsbi'
import LiquidityChartRangeInput from 'components/LiquidityChartRangeInput'
import { SendTxRequest } from '@saberhq/solana-contrib'

const DEFAULT_ADD_IN_RANGE_SLIPPAGE_TOLERANCE = new Percent(50, 10_000)

export default function AddLiquidity({
  match: {
    params: { currencyIdA, currencyIdB, feeAmount: feeAmountFromUrl, tokenId },
  },
  history,
}: RouteComponentProps<{ currencyIdA?: string; currencyIdB?: string; feeAmount?: string; tokenId?: string }>) {
  const { account: accountString, chainId } = useActiveWeb3ReactSol()
  const { connect } = useWalletKit()
  const { connected, wallet, connection } = useSolana()
  const { PublicKey, SystemProgram, Transaction, SYSVAR_RENT_PUBKEY } = anchor.web3
  const { BN } = anchor

  const theme = useContext(ThemeContext)
  const { enqueueSnackbar } = useSnackbar()
  const expertMode = useIsExpertMode()

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
    [Field.CURRENCY_A]: useUSDTValue(parsedAmounts[Field.CURRENCY_A]),
    [Field.CURRENCY_B]: useUSDTValue(parsedAmounts[Field.CURRENCY_B]),
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

  // console.log(+formattedAmounts[Field.CURRENCY_A])
  // console.log(+formattedAmounts[Field.CURRENCY_B])
  async function OnAdd() {
    if (
      !accountString ||
      !currencyA?.wrapped.address ||
      !currencyB?.wrapped.address ||
      !price ||
      !tickLower ||
      !tickUpper
    )
      return

    const account = new PublicKey(accountString)

    setAttemptingTxn(true)

    const provider = new anchor.Provider(connection, wallet as Wallet, {
      skipPreflight: false,
    })
    const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)

    const fee = feeAmount ?? 500
    const tickSpacing = TICK_SPACINGS[fee]
    console.log(feeAmount, tickSpacing)

    // Convinence helpers
    // We get the arbitary SOL addr taken locally when selected from the drop down list
    // Convert this NATIVE_MINT as further all calculations are based on this
    // TODO re-enable devnet support for WSOL

    const WSOL_TOKEN = chainId == 104 ? WSOL_LOCAL : WSOL_MAIN

    const tokenA = currencyA?.wrapped.address.equals(NATIVE_MINT) ? WSOL_TOKEN : currencyA?.wrapped
    const tokenB = currencyB?.wrapped.address.equals(NATIVE_MINT) ? WSOL_TOKEN : currencyB?.wrapped
    const [tk0, tk1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]

    const token0 = new anchor.web3.PublicKey(tk0.address)
    const token1 = new anchor.web3.PublicKey(tk1.address)

    const WSOL_ATA = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      NATIVE_MINT,
      account
    )

    // create fee state
    const [feeState] = await anchor.web3.PublicKey.findProgramAddress([FEE_SEED, u32ToSeed(fee)], cyclosCore.programId)

    // create pool state
    const [poolState] = await PublicKey.findProgramAddress(
      [POOL_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee)],
      cyclosCore.programId
    )

    // create init Observation state
    const [initialObservationState] = await PublicKey.findProgramAddress(
      [OBSERVATION_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee), u16ToSeed(0)],
      cyclosCore.programId
    )

    // fetch observation accounts beforehand to club all txn together
    let observationIndex = 0
    let observationCardinalityNext = 0
    try {
      const data = await cyclosCore.account.poolState.fetch(poolState)
      observationIndex = data.observationIndex
      observationCardinalityNext = data.observationCardinalityNext
    } catch (err) {
      console.log('Fetching default values for oracle observation index')
    }

    const nr = JSBI.BigInt(price.numerator.toString())
    const dr = JSBI.BigInt(price.denominator.toString())
    const sqrtPriceX32 = new BN(encodeSqrtRatioX32(nr, dr).toString())

    const wordPosLower = (tickLower / tickSpacing) >> 8
    const wordPosUpper = (tickUpper / tickSpacing) >> 8

    //fetch ATA of pool tokens
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

    //fetch ATA of user tokens
    const userATA0 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token0,
      account,
      true
    )

    const userATA1 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token1,
      account,
      true
    )

    const [amount0Desired, amount1Desired] = invertPrice
      ? [
          new BN(+formattedAmounts[Field.CURRENCY_B] * Math.pow(10, currencies[Field.CURRENCY_B]?.decimals ?? 0)),
          new BN(+formattedAmounts[Field.CURRENCY_A] * Math.pow(10, currencies[Field.CURRENCY_A]?.decimals ?? 0)),
        ]
      : [
          new BN(+formattedAmounts[Field.CURRENCY_A] * Math.pow(10, currencies[Field.CURRENCY_A]?.decimals ?? 0)),
          new BN(+formattedAmounts[Field.CURRENCY_B] * Math.pow(10, currencies[Field.CURRENCY_B]?.decimals ?? 0)),
        ]

    // If pool not exist, create and init pool
    // Check to see if WSOL_ATA created during pool creation
    let isSOLAccount = false

    // final txn consturction
    const groupedTxn1: SendTxRequest[] = []

    // blockhash needs to be the same across a grouped Txn
    let blockhash

    // Create and init pool
    if (noLiquidity) {
      console.log('Creating and init pool')
      try {
        const tx = new Transaction()

        const wsolAccount = await connection.getAccountInfo(WSOL_ATA)
        if (token0.toString() == NATIVE_MINT.toString() || token1.toString() == NATIVE_MINT.toString()) {
          isSOLAccount = true

          const amount =
            token0?.toString() == NATIVE_MINT.toString() ? amount0Desired.toNumber() : amount1Desired.toNumber()
          console.log(amount)
          if (!wsolAccount) {
            tx.add(
              Token.createAssociatedTokenAccountInstruction(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                NATIVE_MINT,
                WSOL_ATA,
                account,
                account
              )
            )
          }
          tx.add(
            SystemProgram.transfer({
              fromPubkey: account,
              toPubkey: WSOL_ATA,
              lamports: amount,
            }),
            new TransactionInstruction({
              keys: [
                {
                  pubkey: WSOL_ATA,
                  isSigner: false,
                  isWritable: true,
                },
              ],
              data: Buffer.from(new Uint8Array([17])),
              programId: TOKEN_PROGRAM_ID,
            })
          )
        }

        const ix = cyclosCore.instruction.createAndInitPool(sqrtPriceX32, {
          accounts: {
            poolCreator: account,
            token0,
            token1,
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

        tx.add(ix)
        tx.feePayer = account
        tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash
        blockhash = tx.recentBlockhash

        groupedTxn1.push({ tx, signers: [] })
      } catch (err: any) {
        setAttemptingTxn(false)
        enqueueSnackbar(err?.message ?? 'Something went wrong', {
          variant: 'error',
        })
        return
      }
    }

    console.log('Pool Created!')

    // Create tick and bitmap accounts
    const [tickLowerState] = await PublicKey.findProgramAddress(
      [TICK_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee), u32ToSeed(tickLower)],
      cyclosCore.programId
    )
    const [tickUpperState] = await PublicKey.findProgramAddress(
      [TICK_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee), u32ToSeed(tickUpper)],
      cyclosCore.programId
    )
    const [bitmapLowerState] = await PublicKey.findProgramAddress(
      [BITMAP_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee), u16ToSeed(wordPosLower)],
      cyclosCore.programId
    )
    const [bitmapUpperState] = await PublicKey.findProgramAddress(
      [BITMAP_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee), u16ToSeed(wordPosUpper)],
      cyclosCore.programId
    )
    const [factoryState] = await PublicKey.findProgramAddress([], cyclosCore.programId)
    const [corePositionState] = await PublicKey.findProgramAddress(
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

    const data = await connection.getMultipleAccountsInfo([
      tickLowerState,
      tickUpperState,
      bitmapLowerState,
      bitmapUpperState,
      corePositionState,
    ])

    const [tickLowerStateInfo, tickUpperStateInfo, bitmapLowerStateInfo, bitmapUpperStateInfo, corePositionStateInfo] =
      data

    // Build the transaction
    if (
      !corePositionStateInfo ||
      !tickLowerStateInfo ||
      !tickUpperStateInfo ||
      !bitmapLowerStateInfo ||
      !bitmapUpperStateInfo
    ) {
      try {
        const tx = new Transaction()
        tx.recentBlockhash = blockhash

        if (!tickLowerStateInfo) {
          console.log('Creating tickLowerState')
          tx.instructions.push(
            cyclosCore.instruction.initTickAccount(tickLower, {
              accounts: {
                signer: account,
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
            cyclosCore.instruction.initTickAccount(tickUpper, {
              accounts: {
                signer: account,
                poolState: poolState,
                tickState: tickUpperState,
                systemProgram: SystemProgram.programId,
              },
            })
          )
        }

        if (!bitmapLowerStateInfo) {
          console.log('Creating tickbitMapLowerState for word', wordPosLower)
          tx.instructions.push(
            cyclosCore.instruction.initBitmapAccount(wordPosLower, {
              accounts: {
                signer: account,
                poolState: poolState,
                bitmapState: bitmapLowerState,
                systemProgram: SystemProgram.programId,
              },
            })
          )
        }

        if (!bitmapUpperStateInfo && bitmapLowerState.toString() !== bitmapUpperState.toString()) {
          console.log('Creating tickbitMapUpperState for word', wordPosUpper)
          tx.instructions.push(
            cyclosCore.instruction.initBitmapAccount(wordPosUpper, {
              accounts: {
                signer: account,
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
            cyclosCore.instruction.initPositionAccount({
              accounts: {
                signer: account,
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

        tx.feePayer = account

        groupedTxn1.push({ tx, signers: [] })
      } catch (err: any) {
        enqueueSnackbar(err?.message ?? 'Something went wrong', {
          variant: 'error',
        })
        return
      }
    }

    const nftMintKeypair = new anchor.web3.Keypair()

    const [tokenizedPositionState] = await PublicKey.findProgramAddress(
      [POSITION_SEED, nftMintKeypair.publicKey.toBuffer()],
      cyclosCore.programId
    )

    const positionNftAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      nftMintKeypair.publicKey,
      account
    )

    // Add slippage amounts here
    const amount0Minimum = new BN(0)
    const amount1Minimum = new BN(0)
    const deadline = new BN(Date.now() / 1000 + 10_000)

    const [metadataAccount] = await PublicKey.findProgramAddress(
      [
        METADATA_SEED,
        metaplex.programs.metadata.MetadataProgram.PUBKEY.toBuffer(),
        nftMintKeypair.publicKey.toBuffer(),
      ],
      metaplex.programs.metadata.MetadataProgram.PUBKEY
    )

    const [lastObservationState] = await PublicKey.findProgramAddress(
      [OBSERVATION_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee), u16ToSeed(observationIndex)],
      cyclosCore.programId
    )
    const [nextObservationState] = await PublicKey.findProgramAddress(
      [
        OBSERVATION_SEED,
        token0.toBuffer(),
        token1.toBuffer(),
        u32ToSeed(fee),
        u16ToSeed((observationIndex + 1) % observationCardinalityNext),
      ],
      cyclosCore.programId
    )

    if (noLiquidity || !existingPosition) {
      // Create new position
      console.log('Creating new position')
      try {
        const tx1 = new Transaction()
        const tx2 = new Transaction()

        // If Native SOL is used
        if (!isSOLAccount) {
          const wsolAccount = await connection.getAccountInfo(WSOL_ATA)
          if (token0.toString() == NATIVE_MINT.toString() || token1.toString() == NATIVE_MINT.toString()) {
            const amount =
              token0?.toString() == NATIVE_MINT.toString() ? amount0Desired.toNumber() : amount1Desired.toNumber()
            // console.log(amount)
            if (!wsolAccount) {
              tx1.add(
                Token.createAssociatedTokenAccountInstruction(
                  ASSOCIATED_TOKEN_PROGRAM_ID,
                  TOKEN_PROGRAM_ID,
                  NATIVE_MINT,
                  WSOL_ATA,
                  account,
                  account
                )
              )
            }
            tx1.add(
              SystemProgram.transfer({
                fromPubkey: account,
                toPubkey: WSOL_ATA,
                lamports: amount,
              }),
              new TransactionInstruction({
                keys: [
                  {
                    pubkey: WSOL_ATA,
                    isSigner: false,
                    isWritable: true,
                  },
                ],
                data: Buffer.from(new Uint8Array([17])),
                programId: TOKEN_PROGRAM_ID,
              })
            )
            tx1.feePayer = account
            tx1.recentBlockhash = blockhash
          }
        }

        const mintIx = cyclosCore.instruction.mintTokenizedPosition(
          amount0Desired,
          amount1Desired,
          amount0Minimum,
          amount1Minimum,
          deadline,
          {
            accounts: {
              minter: account,
              recipient: account,
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
              lastObservationState,
              tokenizedPositionState: tokenizedPositionState,
              coreProgram: cyclosCore.programId,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            },
            signers: [nftMintKeypair],
            remainingAccounts: [
              {
                pubkey: nextObservationState,
                isSigner: false,
                isWritable: true,
              },
            ],
          }
        )

        tx2.add(mintIx)

        if (token0.toString() == NATIVE_MINT.toString() || token1.toString() == NATIVE_MINT.toString()) {
          // Close the WSOL_ATA
          tx2.add(Token.createCloseAccountInstruction(TOKEN_PROGRAM_ID, WSOL_ATA, account, account, []))
        }

        setAttemptingTxn(true)

        tx2.feePayer = account
        blockhash = (await connection.getRecentBlockhash()).blockhash
        tx2.recentBlockhash = blockhash
        tx2.sign(nftMintKeypair)

        // Cannot sent empty transactions. So add creation of ATA only if required
        const sendReq = [{ tx: tx2, signers: [nftMintKeypair] }]
        if (token0.toString() == NATIVE_MINT.toString() || token1.toString() == NATIVE_MINT.toString()) {
          sendReq.unshift({ tx: tx1, signers: [] })
        }

        groupedTxn1.push(...sendReq)
      } catch (err: any) {
        setAttemptingTxn(false)
        console.log(err)
        enqueueSnackbar(err?.message ?? 'Something went wrong', {
          variant: 'error',
          autoHideDuration: 10000,
        })
        return
      }
      // Create NFT Metadata
      console.log('Creating NFT Metadata')
      try {
        const tx = new Transaction()
        const ix = cyclosCore.instruction.addMetaplexMetadata({
          accounts: {
            payer: account,
            factoryState,
            nftMint: nftMintKeypair.publicKey,
            tokenizedPositionState,
            metadataAccount,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
            metadataProgram: metaplex.programs.metadata.MetadataProgram.PUBKEY,
          },
        })

        tx.add(ix)

        groupedTxn1.push({ tx, signers: [] })
      } catch (err: any) {
        setAttemptingTxn(false)
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
        const [nftMint] = await PublicKey.findProgramAddress(
          [POSITION_SEED, new PublicKey(tokenId!).toBuffer()],
          cyclosCore.programId
        )

        const [lastObservationState] = await PublicKey.findProgramAddress(
          [OBSERVATION_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(fee), u16ToSeed(observationIndex)],
          cyclosCore.programId
        )

        const [nextObservationState] = await PublicKey.findProgramAddress(
          [
            OBSERVATION_SEED,
            token0.toBuffer(),
            token1.toBuffer(),
            u32ToSeed(fee),
            u16ToSeed((observationIndex + 1) % observationCardinalityNext),
          ],
          cyclosCore.programId
        )

        const tx = new Transaction()

        const wsolAccount = await connection.getAccountInfo(WSOL_ATA)
        if (token0.toString() == NATIVE_MINT.toString() || token1.toString() == NATIVE_MINT.toString()) {
          const amount =
            token0?.toString() == NATIVE_MINT.toString() ? amount0Desired.toNumber() : amount1Desired.toNumber()
          // console.log(amount)
          if (!wsolAccount) {
            tx.add(
              Token.createAssociatedTokenAccountInstruction(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                NATIVE_MINT,
                WSOL_ATA,
                account,
                account
              )
            )
          }
          tx.add(
            SystemProgram.transfer({
              fromPubkey: account,
              toPubkey: WSOL_ATA,
              lamports: amount,
            }),
            new TransactionInstruction({
              keys: [
                {
                  pubkey: WSOL_ATA,
                  isSigner: false,
                  isWritable: true,
                },
              ],
              data: Buffer.from(new Uint8Array([17])),
              programId: TOKEN_PROGRAM_ID,
            })
          )
        }

        const ix = cyclosCore.instruction.increaseLiquidity(
          amount0Desired,
          amount1Desired,
          amount0Minimum,
          amount1Minimum,
          deadline,
          {
            accounts: {
              payer: account,
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
              lastObservationState,
              tokenizedPositionState: nftMint,
              coreProgram: cyclosCore.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
            },
            remainingAccounts: [
              {
                pubkey: nextObservationState,
                isSigner: false,
                isWritable: true,
              },
            ],
          }
        )

        tx.add(ix)

        if (token0.toString() == NATIVE_MINT.toString() || token1.toString() == NATIVE_MINT.toString()) {
          // Close the WSOL_ATA
          tx.add(Token.createCloseAccountInstruction(TOKEN_PROGRAM_ID, WSOL_ATA, account, account, []))
        }

        tx.feePayer = account
        tx.recentBlockhash = blockhash

        groupedTxn1.push({ tx, signers: [] })
      } catch (err: any) {
        setAttemptingTxn(false)
        console.log(err)
        enqueueSnackbar(err?.message ?? 'Something went wrong', {
          variant: 'error',
        })
        return
      }
    }

    try {
      const d = await provider?.sendAll(groupedTxn1)
      // console.log(d)
      // Hacky way to display the txn that deducted the tokens
      const lastTxnHash = d.length == 4 ? d[d.length - 2] : d[d.length - 1]
      setTxHash(lastTxnHash ?? '')
    } catch (err: any) {
      setAttemptingTxn(false)
      console.log(err)
      enqueueSnackbar(err?.message ?? 'Something went wrong', {
        variant: 'error',
        autoHideDuration: 10000,
      })
      return
    }

    setAttemptingTxn(false)
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
          currencyIdNew === 'CYS' || (chainId !== undefined && currencyIdNew === SOLCYS_LOCAL.address.toString())
        const isETHOrWETHOther =
          currencyIdOther !== undefined &&
          (currencyIdOther === 'CYS' || (chainId !== undefined && currencyIdOther === SOLCYS_LOCAL.address.toString()))

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
      if (tokenId) {
        return history.push(`/pool/${tokenId}`)
      }
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
                    <span>Add</span>
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
                        <span>Select pair</span>
                      </TYPE.label>
                      <ButtonText onClick={clearAll}>
                        <TYPE.blue fontSize="12px">
                          <span>Clear All</span>
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
                <>
                  <PositionPreview
                    position={existingPosition}
                    title={<span>Selected Range</span>}
                    inRange={!outOfRange}
                  />
                  {/* <LiquidityChartRangeInput
                    currencyA={baseCurrency ?? undefined}
                    currencyB={quoteCurrency ?? undefined}
                    feeAmount={feeAmount}
                    ticksAtLimit={{ [Bound.LOWER]: false, [Bound.UPPER]: false }}
                    price={price ? parseFloat((invertPrice ? price.invert() : price).toSignificant(8)) : undefined}
                    priceLower={priceLower}
                    priceUpper={priceUpper}
                    onLeftRangeInput={onLeftRangeInput}
                    onRightRangeInput={onRightRangeInput}
                    interactive={!hasExistingPosition}
                  /> */}
                </>
              ) : (
                <>
                  {noLiquidity && (
                    <DynamicSection disabled={!currencyA || !currencyB}>
                      <AutoColumn gap="md">
                        <RowBetween>
                          <TYPE.label>
                            <span>Set Starting Price</span>
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
                            <span>Current {baseCurrency?.symbol} Price:</span>
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
                            You are the first liquidity provider for this pool.
                          </TYPE.body>

                          <TYPE.body fontWeight={500} textAlign="center" fontSize={14} style={{ opacity: 0.8 }}>
                            The transaction cost will be relatively higher as it includes the rent to create the pool.
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
                        <span>Set Price Range</span>
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
                      <span>
                        Your liquidity will only earn fees when the market price of the pair is within your range.
                      </span>
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

                    {/* <LiquidityChartRangeInput
                      currencyA={baseCurrency ?? undefined}
                      currencyB={quoteCurrency ?? undefined}
                      feeAmount={feeAmount}
                      ticksAtLimit={{ [Bound.LOWER]: false, [Bound.UPPER]: false }}
                      price={price ? parseFloat((invertPrice ? price.invert() : price).toSignificant(8)) : undefined}
                      priceLower={priceLower}
                      priceUpper={priceUpper}
                      onLeftRangeInput={onLeftRangeInput}
                      onRightRangeInput={onRightRangeInput}
                      interactive={!hasExistingPosition}
                    /> */}

                    {price && baseCurrency && quoteCurrency && !noLiquidity && (
                      <LightCard style={{ padding: '12px' }}>
                        <AutoColumn gap="4px">
                          <TYPE.main fontWeight={500} textAlign="center" fontSize={12}>
                            <span>Current Price</span>
                          </TYPE.main>
                          <TYPE.body fontWeight={500} textAlign="center" fontSize={20}>
                            <HoverInlineText
                              maxCharacters={20}
                              text={invertPrice ? price.invert().toSignificant(6) : price.toSignificant(6)}
                            />{' '}
                          </TYPE.body>
                          <TYPE.main fontWeight={500} textAlign="center" fontSize={12}>
                            <span>
                              {quoteCurrency?.symbol} per {baseCurrency.symbol}
                            </span>
                          </TYPE.main>
                        </AutoColumn>
                      </LightCard>
                    )}

                    {outOfRange ? (
                      <YellowCard padding="8px 12px" $borderRadius="12px">
                        <RowBetween>
                          <AlertTriangle stroke={theme.yellow3} size="16px" />
                          <TYPE.yellow ml="12px" fontSize="12px">
                            <span>
                              Your position will not earn fees or be used in trades until the market price moves into
                              your range.
                            </span>
                          </TYPE.yellow>
                        </RowBetween>
                      </YellowCard>
                    ) : null}

                    {invalidRange ? (
                      <YellowCard padding="8px 12px" $borderRadius="12px">
                        <RowBetween>
                          <AlertTriangle stroke={theme.yellow3} size="16px" />
                          <TYPE.yellow ml="12px" fontSize="12px">
                            <span>Invalid range selected. The min price must be lower than the max price.</span>
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
                  <TYPE.label>{hasExistingPosition ? 'Add more liquidity' : 'Deposit Amounts'}</TYPE.label>

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
                    <span>Connect wallet</span>
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
                      <Text fontWeight={500}>{errorMessage ? errorMessage : <span>Add</span>}</Text>
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
