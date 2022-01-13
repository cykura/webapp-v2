import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NonfungiblePositionManager, Pool, Position, u32ToSeed } from '@uniswap/v3-sdk'

import { PoolState, usePool } from 'hooks/usePools'
import { useToken } from 'hooks/Tokens'
import { useV3PositionFromTokenId } from 'hooks/useV3Positions'
import { Link, RouteComponentProps } from 'react-router-dom'
import { unwrappedToken } from 'utils/unwrappedToken'
import { usePositionTokenURI } from '../../hooks/usePositionTokenURI'
import { calculateGasMargin } from '../../utils/calculateGasMargin'
import { getExplorerLink, ExplorerDataType } from '../../utils/getExplorerLink'
import { LoadingRows } from './styleds'
import styled from 'styled-components/macro'
import { AutoColumn } from 'components/Column'
import { RowBetween, RowFixed } from 'components/Row'
import DoubleCurrencyLogo from 'components/DoubleLogo'
import { ExternalLink, HideExtraSmall, TYPE } from 'theme'
import Badge from 'components/Badge'
import { ButtonConfirmed, ButtonPrimary, ButtonGray } from 'components/Button'
import { DarkCard, LightCard } from 'components/Card'
import CurrencyLogo from 'components/CurrencyLogo'

import { currencyId } from 'utils/currencyId'
import { formatCurrencyAmount } from 'utils/formatCurrencyAmount'
import { useV3PositionFees } from 'hooks/useV3PositionFees'
import { BigNumber } from '@ethersproject/bignumber'
import { Token, Currency, CurrencyAmount, Percent, Fraction, Price } from '@uniswap/sdk-core'
import { useActiveWeb3ReactSol } from 'hooks/web3'
import { useV3NFTPositionManagerContract } from 'hooks/useContract'
import { useIsTransactionPending, useTransactionAdder } from 'state/transactions/hooks'
import ReactGA from 'react-ga'
import TransactionConfirmationModal, { ConfirmationModalContent } from 'components/TransactionConfirmationModal'
import { TransactionResponse } from '@ethersproject/providers'
import { Dots } from 'components/swap/styleds'
import { getPriceOrderingFromPositionForUI } from '../../components/PositionListItem'
import useTheme from '../../hooks/useTheme'
import RateToggle from '../../components/RateToggle'
import { useSingleCallResult } from 'state/multicall/hooks'
import RangeBadge from '../../components/Badge/RangeBadge'
import { SwitchLocaleLink } from '../../components/SwitchLocaleLink'
import useUSDCPrice from 'hooks/useUSDCPrice'
import Loader from 'components/Loader'
import Toggle from 'components/Toggle'
import { Network } from '@saberhq/solana-contrib'
import JSBI from 'jsbi'
import { PROGRAM_ID_STR } from 'constants/addresses'
import * as anchor from '@project-serum/anchor'
import { useSolana } from '@saberhq/use-solana'
import idl from '../../constants/cyclos-core.json'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token as SPLToken } from '@solana/spl-token'
import { TICK_SEED, POOL_SEED, POSITION_SEED, BITMAP_SEED, OBSERVATION_SEED } from 'constants/tokens'
import { u16ToSeed } from 'state/mint/v3/utils'

const { BN, web3 } = anchor
const { PublicKey } = web3

const PageWrapper = styled.div`
  min-width: 800px;
  max-width: 960px;

  ${({ theme }) => theme.mediaWidth.upToMedium`
    min-width: 680px;
    max-width: 680px;
  `};

  ${({ theme }) => theme.mediaWidth.upToSmall`
    min-width: 600px;
    max-width: 600px;
  `};

  @media only screen and (max-width: 620px) {
    min-width: 500px;
    max-width: 500px;
  }

  ${({ theme }) => theme.mediaWidth.upToExtraSmall`
    min-width: 340px;
    max-width: 340px;
  `};
`

const BadgeText = styled.div`
  font-weight: 500;
  font-size: 14px;
`

// responsive text
// disable the warning because we don't use the end prop, we just want to filter it out
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Label = styled(({ end, ...props }) => <TYPE.label {...props} />)<{ end?: boolean }>`
  display: flex;
  font-size: 16px;
  justify-content: ${({ end }) => (end ? 'flex-end' : 'flex-start')};
  align-items: center;
`

const ExtentsText = styled.span`
  color: ${({ theme }) => theme.text2};
  font-size: 14px;
  text-align: center;
  margin-right: 4px;
  font-weight: 500;
`

const HoverText = styled(TYPE.main)`
  text-decoration: none;
  color: ${({ theme }) => theme.text3};
  :hover {
    color: ${({ theme }) => theme.text1};
    text-decoration: none;
  }
`

const DoubleArrow = styled.span`
  color: ${({ theme }) => theme.text3};
  margin: 0 1rem;
`
const ResponsiveRow = styled(RowBetween)`
  ${({ theme }) => theme.mediaWidth.upToSmall`
    flex-direction: column;
    align-items: flex-start;
    row-gap: 16px;
    width: 100%:
  `};
`

const ResponsiveButtonPrimary = styled(ButtonPrimary)`
  border-radius: 12px;
  padding: 6px 8px;
  width: fit-content;
  ${({ theme }) => theme.mediaWidth.upToSmall`
    flex: 1 1 auto;
    width: 49%;
  `};
`

const NFTGrid = styled.div`
  display: grid;
  grid-template: 'overlap';
  min-height: 400px;
`

const NFTCanvas = styled.canvas`
  grid-area: overlap;
`

const NFTImage = styled.img`
  grid-area: overlap;
  height: 400px;
  /* Ensures SVG appears on top of canvas. */
  z-index: 1;
`

function CurrentPriceCard({
  inverted,
  pool,
  currencyQuote,
  currencyBase,
}: {
  inverted?: boolean
  pool?: Pool | null
  currencyQuote?: Currency
  currencyBase?: Currency
}) {
  if (!pool || !currencyQuote || !currencyBase) {
    return null
  }

  return (
    <LightCard padding="12px ">
      <AutoColumn gap="8px" justify="center">
        <ExtentsText>
          <span>Current price</span>
        </ExtentsText>
        <TYPE.mediumHeader textAlign="center">
          {(inverted ? pool.token1Price : pool.token0Price).toSignificant(6)}{' '}
        </TYPE.mediumHeader>
        <ExtentsText>
          <span>
            {currencyQuote?.symbol} per {currencyBase?.symbol}
          </span>
        </ExtentsText>
      </AutoColumn>
    </LightCard>
  )
}

function LinkedCurrency({ network, currency }: { network?: Network; currency?: Currency }) {
  const address = (currency as Token)?.address

  if (network && address) {
    return (
      <ExternalLink href={getExplorerLink(network, address, ExplorerDataType.TOKEN)}>
        <RowFixed>
          <CurrencyLogo currency={currency} size={'20px'} style={{ marginRight: '0.5rem' }} />
          <TYPE.main>{currency?.symbol} ↗</TYPE.main>
        </RowFixed>
      </ExternalLink>
    )
  }

  return (
    <RowFixed>
      <CurrencyLogo currency={currency} size={'20px'} style={{ marginRight: '0.5rem' }} />
      <TYPE.main>{currency?.symbol}</TYPE.main>
    </RowFixed>
  )
}

function getRatio(
  lower: Price<Currency, Currency>,
  current: Price<Currency, Currency>,
  upper: Price<Currency, Currency>
) {
  try {
    if (!current.greaterThan(lower)) {
      return 100
    } else if (!current.lessThan(upper)) {
      return 0
    }

    const a = Number.parseFloat(lower.toSignificant(15))
    const b = Number.parseFloat(upper.toSignificant(15))
    const c = Number.parseFloat(current.toSignificant(15))

    const ratio = Math.floor((1 / ((Math.sqrt(a * b) - Math.sqrt(b * c)) / (c - Math.sqrt(b * c)) + 1)) * 100)

    if (ratio < 0 || ratio > 100) {
      throw Error('Out of range')
    }

    return ratio
  } catch {
    return undefined
  }
}

// snapshots a src img into a canvas
function getSnapshot(src: HTMLImageElement, canvas: HTMLCanvasElement, targetHeight: number) {
  const context = canvas.getContext('2d')

  if (context) {
    let { width, height } = src

    // src may be hidden and not have the target dimensions
    const ratio = width / height
    height = targetHeight
    width = Math.round(ratio * targetHeight)

    // Ensure crispness at high DPIs
    canvas.width = width * devicePixelRatio
    canvas.height = height * devicePixelRatio
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    context.scale(devicePixelRatio, devicePixelRatio)

    context.clearRect(0, 0, width, height)
    context.drawImage(src, 0, 0, width, height)
  }
}

function NFT({ image, height: targetHeight }: { image: string; height: number }) {
  const [animate, setAnimate] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  return (
    <NFTGrid
      onMouseEnter={() => {
        setAnimate(true)
      }}
      onMouseLeave={() => {
        // snapshot the current frame so the transition to the canvas is smooth
        if (imageRef.current && canvasRef.current) {
          getSnapshot(imageRef.current, canvasRef.current, targetHeight)
        }
        setAnimate(false)
      }}
    >
      <NFTCanvas ref={canvasRef} />
      <NFTImage
        ref={imageRef}
        src={image}
        hidden={false}
        // hidden={!animate}
        onLoad={() => {
          // snapshot for the canvas
          if (imageRef.current && canvasRef.current) {
            getSnapshot(imageRef.current, canvasRef.current, targetHeight)
          }
        }}
      />
    </NFTGrid>
  )
}

export function PositionPage({
  match: {
    params: { tokenId: tokenIdFromUrl },
  },
}: RouteComponentProps<{ tokenId?: string }>) {
  const { network } = useSolana()
  const { account, librarySol } = useActiveWeb3ReactSol()
  const theme = useTheme()

  const parsedTokenId = tokenIdFromUrl ?? undefined

  const { loading, position: positionDetails } = useV3PositionFromTokenId(parsedTokenId)

  const {
    token0: token0Address,
    token1: token1Address,
    fee: feeAmount,
    liquidity,
    tickLower,
    tickUpper,
    tokenId,
    feeGrowthInside0LastX128,
    feeGrowthInside1LastX128,
    tokensOwed0,
    tokensOwed1,
  } = positionDetails || {}

  const removed = JSBI.EQ(liquidity, 0)

  const token0 = useToken(token0Address)
  const token1 = useToken(token1Address)

  const metadata = usePositionTokenURI(parsedTokenId)

  const currency0 = token0 ? unwrappedToken(token0) : undefined
  const currency1 = token1 ? unwrappedToken(token1) : undefined

  // flag for receiving WETH
  const [receiveWETH, setReceiveWETH] = useState(false)

  // construct Position from details returned
  const pool = usePool(token0 ?? undefined, token1 ?? undefined, feeAmount)
  const position = useMemo(() => {
    if (pool && liquidity && typeof tickLower === 'number' && typeof tickUpper === 'number') {
      // console.log(
      //   `POSITION PAGE\nprice is ${pool.sqrtRatioX32.toString()}\ntokenLower is ${tickLower}\ntokenUpper is ${tickUpper}`
      // )
      return new Position({ pool, liquidity: liquidity.toString(), tickLower, tickUpper })
    }
    return undefined
  }, [liquidity, pool, tickLower, tickUpper])

  let { priceLower, priceUpper, base, quote } = getPriceOrderingFromPositionForUI(position)
  const [manuallyInverted, setManuallyInverted] = useState(false)
  // handle manual inversion
  if (manuallyInverted) {
    ;[priceLower, priceUpper, base, quote] = [priceUpper?.invert(), priceLower?.invert(), quote, base]
  }
  const inverted = token1 ? base?.equals(token1) : undefined
  const currencyQuote = inverted ? currency0 : currency1
  const currencyBase = inverted ? currency1 : currency0

  // check if price is within range
  const below = pool && typeof tickLower === 'number' ? pool.tickCurrent < tickLower : undefined
  const above = pool && typeof tickUpper === 'number' ? pool.tickCurrent >= tickUpper : undefined
  const inRange: boolean = typeof below === 'boolean' && typeof above === 'boolean' ? !below && !above : false

  const ratio = useMemo(() => {
    return priceLower && pool && priceUpper
      ? getRatio(
          inverted ? priceUpper.invert() : priceLower,
          pool.token0Price,
          inverted ? priceLower.invert() : priceUpper
        )
      : undefined
  }, [inverted, pool, priceLower, priceUpper])

  // fees
  const [feeValue0, feeValue1] = useV3PositionFees(pool ?? undefined, parsedTokenId ?? undefined, receiveWETH)

  const [collecting, setCollecting] = useState<boolean>(false)
  const [collectMigrationHash, setCollectMigrationHash] = useState<string | null>(null)
  const isCollectPending = useIsTransactionPending(collectMigrationHash ?? undefined)
  const [showConfirm, setShowConfirm] = useState(false)

  const { connection, wallet } = useSolana()

  const addTransaction = useTransactionAdder()
  const positionManager = useV3NFTPositionManagerContract()

  const collect = useCallback(async () => {
    console.log('collect called')
    if (
      !network ||
      !feeValue0 ||
      !feeValue1 ||
      // !positionManager ||
      !wallet ||
      !account ||
      !tokenId ||
      !parsedTokenId ||
      // !librarySol ||
      !pool ||
      !tickLower ||
      !tickUpper ||
      !token0 ||
      !token1 ||
      !feeAmount ||
      !liquidity ||
      // !tokensOwed0 ||
      // !tokensOwed1 ||
      !feeGrowthInside0LastX128 ||
      !feeGrowthInside1LastX128
    )
      return

    setCollecting(true)

    // calling the contract
    try {
      setCollecting(false)
      console.log(feeValue0.toSignificant(), feeValue1.toSignificant())
      // const amount0 = +feeValue0.toSignificant() > 0 ? new BN(feeValue0.toSignificant()) : 0
      // const amount1 = +feeValue1.toSignificant() > 0 ? new BN(feeValue1.toSignificant()) : 0

      // console.log(amount0.toString(), amount1.toString())

      const provider = new anchor.Provider(connection, wallet as Wallet, {
        skipPreflight: false,
      })
      const cyclosCore = new anchor.Program(idl as anchor.Idl, PROGRAM_ID_STR, provider)

      const token0Add = new PublicKey(token0.address)
      const token1Add = new PublicKey(token1.address)

      const [tickLowerState, tickLowerStateBump] = await PublicKey.findProgramAddress(
        [TICK_SEED, token0Add.toBuffer(), token1Add.toBuffer(), u32ToSeed(feeAmount), u32ToSeed(tickLower)],
        cyclosCore.programId
      )

      const [tickUpperState, tickUpperStateBump] = await PublicKey.findProgramAddress(
        [TICK_SEED, token0Add.toBuffer(), token1Add.toBuffer(), u32ToSeed(feeAmount), u32ToSeed(tickUpper)],
        cyclosCore.programId
      )

      const [poolState, poolStateBump] = await PublicKey.findProgramAddress(
        [POOL_SEED, token0Add.toBuffer(), token1Add.toBuffer(), u32ToSeed(feeAmount)],
        cyclosCore.programId
      )

      const [factoryState, factoryStateBump] = await PublicKey.findProgramAddress([], cyclosCore.programId)

      const [corePositionState, corePositionBump] = await PublicKey.findProgramAddress(
        [
          POSITION_SEED,
          token0Add.toBuffer(),
          token1Add.toBuffer(),
          u32ToSeed(feeAmount),
          factoryState.toBuffer(),
          u32ToSeed(tickLower),
          u32ToSeed(tickUpper),
        ],
        cyclosCore.programId
      )

      const [tokenizedPositionState, tokenizedPositionBump] = await PublicKey.findProgramAddress(
        [POSITION_SEED, new PublicKey(parsedTokenId).toBuffer()],
        cyclosCore.programId
      )

      const positionNftAccount = await SPLToken.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        new PublicKey(parsedTokenId),
        wallet.publicKey!
      )

      const tickSpacing = feeAmount / 50

      const wordPosLower = (tickLower / tickSpacing) >> 8
      const wordPosUpper = (tickUpper / tickSpacing) >> 8

      const [bitmapLowerState, bitmapLowerBump] = await PublicKey.findProgramAddress(
        [BITMAP_SEED, token0Add.toBuffer(), token1Add.toBuffer(), u32ToSeed(feeAmount), u16ToSeed(wordPosLower)],
        cyclosCore.programId
      )

      const [bitmapUpperState, bitmapUpperBump] = await PublicKey.findProgramAddress(
        [BITMAP_SEED, token0Add.toBuffer(), token1Add.toBuffer(), u32ToSeed(feeAmount), u16ToSeed(wordPosUpper)],
        cyclosCore.programId
      )

      const { observationIndex, observationCardinalityNext } = await cyclosCore.account.poolState.fetch(poolState)

      const latestObservationState = (
        await PublicKey.findProgramAddress(
          [
            OBSERVATION_SEED,
            token0Add.toBuffer(),
            token1Add.toBuffer(),
            u32ToSeed(feeAmount),
            u16ToSeed(observationIndex),
          ],
          cyclosCore.programId
        )
      )[0]

      const vault0 = await SPLToken.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        token0Add,
        poolState,
        true
      )
      const vault1 = await SPLToken.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        token1Add,
        poolState,
        true
      )

      //fetch ATA of pool tokens
      const userATA0 = await SPLToken.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        token0Add,
        new PublicKey(account),
        true
      )
      // console.log(`user ATA 0 -> ${userATA0.toString()}`)
      const userATA1 = await SPLToken.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        token1Add,
        new PublicKey(account),
        true
      )

      const nextObservationState = (
        await PublicKey.findProgramAddress(
          [
            OBSERVATION_SEED,
            token0Add.toBuffer(),
            token1Add.toBuffer(),
            u32ToSeed(feeAmount),
            u16ToSeed((observationIndex + 1) % observationCardinalityNext),
          ],
          cyclosCore.programId
        )
      )[0]

      const txHash = await cyclosCore.rpc.collectFromTokenized(
        new BN(2).pow(new BN(64)).subn(1),
        new BN(2).pow(new BN(64)).subn(1),
        {
          accounts: {
            ownerOrDelegate: owner,
            nftAccount: positionNftAccount,
            tokenizedPositionState: tokenizedPositionState,
            factoryState,
            poolState: poolState,
            corePositionState: corePositionState,
            tickLowerState: tickLowerState,
            tickUpperState: tickUpperState,
            bitmapLowerState: bitmapLowerState,
            bitmapUpperState: bitmapUpperState,
            latestObservationState: latestObservationState,
            nextObservationState: nextObservationState,
            coreProgram: cyclosCore.programId,
            vault0: vault0,
            vault1: vault1,
            recipientWallet0: userATA0,
            recipientWallet1: userATA1,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
        }
      )
      setCollectMigrationHash(txHash)
    } catch (e) {
      setCollecting(false)

      console.log(e)
    }

    // const { calldata, value } = NonfungiblePositionManager.collectCallParameters({
    //   tokenId: tokenId.toString(),
    //   expectedCurrencyOwed0: feeValue0,
    //   expectedCurrencyOwed1: feeValue1,
    //   recipient: account,
    // })

    // const txn = {
    //   to: positionManager.address,
    //   data: calldata,
    //   value,
    // }

    // librarySol
    //   ?.getSigner()
    //   .estimateGas(txn)
    //   .then((estimate: any) => {
    //     const newTxn = {
    //       ...txn,
    //       gasLimit: calculateGasMargin(estimate),
    //     }

    //     return librarySol
    //       ?.getSigner()
    //       .sendTransaction(newTxn)
    //       .then((response: TransactionResponse) => {
    //         setCollectMigrationHash(response.hash)
    //         setCollecting(false)

    //         ReactGA.event({
    //           category: 'Liquidity',
    //           action: 'CollectV3',
    //           label: [feeValue0.currency.symbol, feeValue1.currency.symbol].join('/'),
    //         })

    //         addTransaction(response, {
    //           summary: `Collect ${feeValue0.currency.symbol}/${feeValue1.currency.symbol} fees`,
    //         })
    //       })
    //   })
    //   .catch((error: any) => {
    //     setCollecting(false)
    //     console.error(error)
    //   })
  }, [network, feeValue0, feeValue1, positionManager, account, tokenId, addTransaction, librarySol])

  // const owner = useSingleCallResult(!!tokenId ? positionManager : null, 'ownerOf', [tokenId]).result?.[0]
  const owner = account ?? undefined
  const ownsNFT = positionDetails?.operator === account

  // usdc prices always in terms of tokens
  const price0 = useUSDCPrice(token0 ?? undefined)
  const price1 = useUSDCPrice(token1 ?? undefined)

  const fiatValueOfFees: CurrencyAmount<Currency> | null = useMemo(() => {
    if (!price0 || !price1 || !feeValue0 || !feeValue1) return null

    // we wrap because it doesn't matter, the quote returns a USDC amount
    const feeValue0Wrapped = feeValue0?.wrapped
    const feeValue1Wrapped = feeValue1?.wrapped

    if (!feeValue0Wrapped || !feeValue1Wrapped) return null

    const amount0 = price0.quote(feeValue0Wrapped)
    const amount1 = price1.quote(feeValue1Wrapped)
    return amount0.add(amount1)
  }, [price0, price1, feeValue0, feeValue1])

  const fiatValueOfLiquidity: CurrencyAmount<Token> | null = useMemo(() => {
    if (!price0 || !price1 || !position) return null
    const amount0 = price0.quote(position.amount0)
    const amount1 = price1.quote(position.amount1)
    return amount0.add(amount1)
  }, [price0, price1, position])

  const feeValueUpper = inverted ? feeValue0 : feeValue1
  const feeValueLower = inverted ? feeValue1 : feeValue0

  function modalHeader() {
    return (
      <AutoColumn gap={'md'} style={{ marginTop: '20px' }}>
        <LightCard padding="12px 16px">
          <AutoColumn gap="md">
            <RowBetween>
              <RowFixed>
                <CurrencyLogo currency={feeValueUpper?.currency} size={'20px'} style={{ marginRight: '0.5rem' }} />
                <TYPE.main>{feeValueUpper ? formatCurrencyAmount(feeValueUpper, 4) : '-'}</TYPE.main>
              </RowFixed>
              <TYPE.main>{feeValueUpper?.currency?.symbol}</TYPE.main>
            </RowBetween>
            <RowBetween>
              <RowFixed>
                <CurrencyLogo currency={feeValueLower?.currency} size={'20px'} style={{ marginRight: '0.5rem' }} />
                <TYPE.main>{feeValueLower ? formatCurrencyAmount(feeValueLower, 4) : '-'}</TYPE.main>
              </RowFixed>
              <TYPE.main>{feeValueLower?.currency?.symbol}</TYPE.main>
            </RowBetween>
          </AutoColumn>
        </LightCard>
        <TYPE.italic>
          <span>Collecting fees will withdraw currently available fees for you.</span>
        </TYPE.italic>
        <ButtonPrimary onClick={collect}>
          <span>Collect</span>
        </ButtonPrimary>
      </AutoColumn>
    )
  }

  return loading || !pool || !feeAmount ? (
    <LoadingRows>
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
    </LoadingRows>
  ) : (
    <>
      <PageWrapper>
        <TransactionConfirmationModal
          isOpen={showConfirm}
          onDismiss={() => setShowConfirm(false)}
          attemptingTxn={collecting}
          hash={collectMigrationHash ?? ''}
          content={() => (
            <ConfirmationModalContent
              title={<span>Claim fees</span>}
              onDismiss={() => setShowConfirm(false)}
              topContent={modalHeader}
            />
          )}
          pendingText={<span>Collecting fees</span>}
        />
        <AutoColumn gap="md">
          <AutoColumn gap="sm">
            <Link style={{ textDecoration: 'none', width: 'fit-content', marginBottom: '0.5rem' }} to="/pool">
              <HoverText>
                <span>← Back to Pools Overview</span>
              </HoverText>
            </Link>
            <ResponsiveRow>
              <RowFixed>
                <DoubleCurrencyLogo currency0={currencyBase} currency1={currencyQuote} size={24} margin={true} />
                <TYPE.label fontSize={'24px'} mr="10px">
                  &nbsp;{currencyQuote?.symbol}&nbsp;/&nbsp;{currencyBase?.symbol}
                </TYPE.label>
                <Badge style={{ marginRight: '8px' }}>
                  <BadgeText>
                    <span>{new Percent(feeAmount, 1_000_000).toSignificant()}%</span>
                  </BadgeText>
                </Badge>
                <RangeBadge removed={removed} inRange={inRange} />
              </RowFixed>
              {ownsNFT && (
                <RowFixed>
                  {currency0 && currency1 && feeAmount && tokenId ? (
                    <ButtonGray
                      as={Link}
                      to={`/increase/${currencyId(currency0)}/${currencyId(currency1)}/${feeAmount}/${tokenId}`}
                      width="fit-content"
                      padding="6px 8px"
                      $borderRadius="12px"
                      style={{ marginRight: '8px' }}
                    >
                      <span>Increase Liquidity</span>
                    </ButtonGray>
                  ) : null}
                  {tokenId && !removed ? (
                    <ResponsiveButtonPrimary
                      as={Link}
                      to={`/remove/${tokenId}`}
                      width="fit-content"
                      padding="6px 8px"
                      $borderRadius="12px"
                    >
                      <span>Remove Liquidity</span>
                    </ResponsiveButtonPrimary>
                  ) : null}
                </RowFixed>
              )}
            </ResponsiveRow>
            <RowBetween></RowBetween>
          </AutoColumn>
          <ResponsiveRow align="flex-start">
            {'result' in metadata ? (
              <DarkCard
                width="100%"
                height="100%"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexDirection: 'column',
                  justifyContent: 'space-around',
                  marginRight: '12px',
                }}
              >
                <div style={{ marginRight: 12 }}>
                  <NFT image={metadata.result.image} height={400} />
                </div>
                {network && owner && !ownsNFT ? (
                  <ExternalLink href={getExplorerLink(network, owner, ExplorerDataType.ADDRESS)}>
                    <span>Something went wrong. You dont own this position</span>
                  </ExternalLink>
                ) : null}
              </DarkCard>
            ) : (
              <DarkCard
                width="100%"
                height="100%"
                style={{
                  marginRight: '12px',
                  minWidth: '340px',
                }}
              >
                <Loader />
              </DarkCard>
            )}
            <AutoColumn gap="sm" style={{ width: '100%', height: '100%' }}>
              <DarkCard>
                <AutoColumn gap="md" style={{ width: '100%' }}>
                  <AutoColumn gap="md">
                    <Label>
                      <span>Liquidity</span>
                    </Label>
                    {fiatValueOfLiquidity?.greaterThan(new Fraction(1, 100)) ? (
                      <TYPE.largeHeader fontSize="36px" fontWeight={500}>
                        <span>${fiatValueOfLiquidity.toFixed(2, { groupSeparator: ',' })}</span>
                      </TYPE.largeHeader>
                    ) : (
                      <TYPE.largeHeader color={theme.text1} fontSize="36px" fontWeight={500}>
                        <span>$-</span>
                      </TYPE.largeHeader>
                    )}
                  </AutoColumn>
                  <LightCard padding="12px 16px">
                    <AutoColumn gap="md">
                      <RowBetween>
                        <LinkedCurrency network={network} currency={currencyQuote} />
                        <RowFixed>
                          <TYPE.main>
                            {inverted ? position?.amount0.toSignificant(4) : position?.amount1.toSignificant(4)}
                          </TYPE.main>
                          {typeof ratio === 'number' && !removed ? (
                            <Badge style={{ marginLeft: '10px' }}>
                              <TYPE.main fontSize={11}>
                                <span>{inverted ? ratio : 100 - ratio}%</span>
                              </TYPE.main>
                            </Badge>
                          ) : null}
                        </RowFixed>
                      </RowBetween>
                      <RowBetween>
                        <LinkedCurrency network={network} currency={currencyBase} />
                        <RowFixed>
                          <TYPE.main>
                            {inverted ? position?.amount1.toSignificant(4) : position?.amount0.toSignificant(4)}
                          </TYPE.main>
                          {typeof ratio === 'number' && !removed ? (
                            <Badge style={{ marginLeft: '10px' }}>
                              <TYPE.main color={theme.text2} fontSize={11}>
                                <span>{inverted ? 100 - ratio : ratio}%</span>
                              </TYPE.main>
                            </Badge>
                          ) : null}
                        </RowFixed>
                      </RowBetween>
                    </AutoColumn>
                  </LightCard>
                </AutoColumn>
              </DarkCard>
              <DarkCard>
                <AutoColumn gap="md" style={{ width: '100%' }}>
                  <AutoColumn gap="md">
                    <RowBetween style={{ alignItems: 'flex-start' }}>
                      <AutoColumn gap="md">
                        <Label>
                          <span>Unclaimed fees</span>
                        </Label>
                        {fiatValueOfFees?.greaterThan(new Fraction(1, 100)) ? (
                          <TYPE.largeHeader color={theme.green1} fontSize="36px" fontWeight={500}>
                            <span>${fiatValueOfFees.toFixed(2, { groupSeparator: ',' })}</span>
                          </TYPE.largeHeader>
                        ) : (
                          <TYPE.largeHeader color={theme.text1} fontSize="36px" fontWeight={500}>
                            <span>$-</span>
                          </TYPE.largeHeader>
                        )}
                      </AutoColumn>
                      {ownsNFT && (feeValue0?.greaterThan(0) || feeValue1?.greaterThan(0) || !!collectMigrationHash) ? (
                        <ButtonConfirmed
                          disabled={collecting || !!collectMigrationHash}
                          confirmed={!!collectMigrationHash && !isCollectPending}
                          width="fit-content"
                          style={{ borderRadius: '12px' }}
                          padding="4px 8px"
                          onClick={() => setShowConfirm(true)}
                        >
                          {!!collectMigrationHash && !isCollectPending ? (
                            <TYPE.main color={theme.black}>
                              <span> Collected</span>
                            </TYPE.main>
                          ) : isCollectPending || collecting ? (
                            <TYPE.main color={theme.black}>
                              {' '}
                              <Dots>
                                <span>Collecting</span>
                              </Dots>
                            </TYPE.main>
                          ) : (
                            <>
                              <TYPE.main color={theme.black}>
                                <span>Collect fees</span>
                              </TYPE.main>
                            </>
                          )}
                        </ButtonConfirmed>
                      ) : null}
                    </RowBetween>
                  </AutoColumn>
                  <LightCard padding="12px 16px">
                    <AutoColumn gap="md">
                      <RowBetween>
                        <RowFixed>
                          <CurrencyLogo
                            currency={feeValueUpper?.currency}
                            size={'20px'}
                            style={{ marginRight: '0.5rem' }}
                          />
                          <TYPE.main>{feeValueUpper?.currency?.symbol}</TYPE.main>
                        </RowFixed>
                        <RowFixed>
                          <TYPE.main>{feeValueUpper ? formatCurrencyAmount(feeValueUpper, 4) : '-'}</TYPE.main>
                        </RowFixed>
                      </RowBetween>
                      <RowBetween>
                        <RowFixed>
                          <CurrencyLogo
                            currency={feeValueLower?.currency}
                            size={'20px'}
                            style={{ marginRight: '0.5rem' }}
                          />
                          <TYPE.main>{feeValueLower?.currency?.symbol}</TYPE.main>
                        </RowFixed>
                        <RowFixed>
                          <TYPE.main>{feeValueLower ? formatCurrencyAmount(feeValueLower, 4) : '-'}</TYPE.main>
                        </RowFixed>
                      </RowBetween>
                    </AutoColumn>
                  </LightCard>
                </AutoColumn>
              </DarkCard>
            </AutoColumn>
          </ResponsiveRow>
          <DarkCard>
            <AutoColumn gap="md">
              <RowBetween>
                <RowFixed>
                  <Label display="flex" style={{ marginRight: '12px' }}>
                    <span>Price range</span>
                  </Label>
                  <HideExtraSmall>
                    <>
                      <RangeBadge removed={removed} inRange={inRange} />
                      <span style={{ width: '8px' }} />
                    </>
                  </HideExtraSmall>
                </RowFixed>
                <RowFixed>
                  {currencyBase && currencyQuote && (
                    <RateToggle
                      currencyA={currencyBase}
                      currencyB={currencyQuote}
                      handleRateToggle={() => setManuallyInverted(!manuallyInverted)}
                    />
                  )}
                </RowFixed>
              </RowBetween>

              <RowBetween>
                <LightCard padding="12px" width="100%">
                  <AutoColumn gap="8px" justify="center">
                    <ExtentsText>
                      <span>Min price</span>
                    </ExtentsText>
                    <TYPE.mediumHeader textAlign="center">{priceLower?.toSignificant(5)}</TYPE.mediumHeader>
                    <ExtentsText>
                      {' '}
                      <span>
                        {currencyQuote?.symbol} per {currencyBase?.symbol}
                      </span>
                    </ExtentsText>

                    {inRange && (
                      <TYPE.small color={theme.text3}>
                        <span>Your position will be 100% {currencyBase?.symbol} at this price.</span>
                      </TYPE.small>
                    )}
                  </AutoColumn>
                </LightCard>

                <DoubleArrow>⟷</DoubleArrow>
                <LightCard padding="12px" width="100%">
                  <AutoColumn gap="8px" justify="center">
                    <ExtentsText>
                      <span>Max price</span>
                    </ExtentsText>
                    <TYPE.mediumHeader textAlign="center">{priceUpper?.toSignificant(5)}</TYPE.mediumHeader>
                    <ExtentsText>
                      {' '}
                      <span>
                        {currencyQuote?.symbol} per {currencyBase?.symbol}
                      </span>
                    </ExtentsText>

                    {inRange && (
                      <TYPE.small color={theme.text3}>
                        <span>Your position will be 100% {currencyQuote?.symbol} at this price.</span>
                      </TYPE.small>
                    )}
                  </AutoColumn>
                </LightCard>
              </RowBetween>
              <CurrentPriceCard
                inverted={inverted}
                pool={pool}
                currencyQuote={currencyQuote}
                currencyBase={currencyBase}
              />
            </AutoColumn>
          </DarkCard>
        </AutoColumn>
      </PageWrapper>
      <SwitchLocaleLink />
    </>
  )
}
