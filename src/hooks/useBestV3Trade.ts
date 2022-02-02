import { PublicKey } from '@solana/web3.js'
import JSBI from 'jsbi'
import { Currency, CurrencyAmount, Fraction, TradeType, Token as UniToken } from '@uniswap/sdk-core'
import { encodeRouteToPath, FeeAmount, Pool, Route, Trade } from '@uniswap/v3-sdk'
import { useEffect, useMemo, useState } from 'react'
import { useSingleContractMultipleData } from '../state/multicall/hooks'
import { useAllV3Routes } from './useAllV3Routes'
import { usePool } from './usePools'
import { BN } from '@project-serum/anchor'
import { useDerivedSwapInfo } from 'state/swap/hooks'
import { SolanaTickDataProvider } from './useSwapCallback'
import { useSolana } from '@saberhq/use-solana'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { PROGRAM_ID_STR } from 'constants/addresses'
import { CyclosCore, IDL } from 'types/cyclos-core'
import * as anchor from '@project-serum/anchor'

export enum V3TradeState {
  LOADING,
  INVALID,
  NO_ROUTE_FOUND,
  VALID,
  SYNCING,
}

export type CysTrade =
  | {
      route: PublicKey
      inputAmount: CurrencyAmount<Currency>
      outputAmount: CurrencyAmount<Currency>
    }
  | null
  | undefined

export interface CyclosTrade {
  state: V3TradeState
  trade: CysTrade
}

/**
 * Returns the best v3 trade for a desired exact input swap
 * @param amountIn the amount to swap in
 * @param currencyOut the desired output currency
 */
export function useBestV3TradeExactIn(
  amountIn?: CurrencyAmount<Currency>,
  currencyOut?: Currency
  // ): { state: V3TradeState; trade: Trade<Currency, Currency, TradeType.EXACT_INPUT> | null } {
): CyclosTrade {
  // console.log('input token', amountIn?.currency)
  // console.log('output token', currencyOut)
  // const quoter = useV3Quoter()
  const { connection, wallet } = useSolana()
  const provider = new anchor.Provider(connection, wallet as Wallet, {
    skipPreflight: true,
  })
  const cyclosCore = new anchor.Program<CyclosCore>(IDL, PROGRAM_ID_STR, provider)

  const { routes, loading: routesLoading } = useAllV3Routes(amountIn?.currency, currencyOut)

  // Hacky solution to find output amount based on current pool price
  // TODO build quoter on client side to find price impact
  // TODO support routing across all fee tiers. Currently only done across the 0.01% pool
  const pool = usePool(amountIn?.currency, currencyOut, 500)
  // const quoteExactInInputs = useMemo(() => {
  //   return routes.map((route) => [
  //     encodeRouteToPath(route, false),
  //     amountIn ? `0x${amountIn.quotient.toString(16)}` : undefined,
  //   ])
  // }, [amountIn, routes])
  console.log(pool)
  const [amntOut, setAmntOut] = useState<CurrencyAmount<Currency> | null>(null)
  // const quotesResults = useSingleContractMultipleData(quoter, 'quoteExactInput', quoteExactInInputs)

  useEffect(() => {
    if (!amountIn || !currencyOut || !pool || !routes[0]) return
    ;(async () => {
      const MaxU32 = JSBI.BigInt('0xffffffff')
      const factor =
        (amountIn.currency as UniToken).address === pool.token0.address
          ? new Fraction(pool.sqrtRatioX32, MaxU32)
          : new Fraction(MaxU32, pool.sqrtRatioX32)
      const out = amountIn.multiply(factor)
      const amountOut = CurrencyAmount.fromFractionalAmount(currencyOut, out.numerator, out.denominator)
      try {
        const { tick, sqrtPriceX32, liquidity, token0, token1 } = await cyclosCore.account.poolState.fetch(routes[0])
        // TODO replace hardcoded fee and token decimal places
        const fee = 500
        const tickDataProvider = new SolanaTickDataProvider(cyclosCore, {
          token0,
          token1,
          fee,
        })

        const uniToken0 = new UniToken(0, token0.toString(), 6)
        const uniToken1 = new UniToken(0, token1.toString(), 6)

        // output is one tick behind actual (8 instead of 9)
        const uniPoolA = new Pool(
          uniToken0,
          uniToken1,
          fee,
          JSBI.BigInt(sqrtPriceX32),
          JSBI.BigInt(liquidity),
          tick,
          tickDataProvider
        )
        const zeroForOne = new PublicKey(amountIn?.currency?.wrapped?.address).equals(token0)
        const amntIn = new BN(amountIn.numerator[0])
        const [expectedAmountOut] = await uniPoolA.getOutputAmount(
          CurrencyAmount.fromRawAmount(zeroForOne ? uniToken0 : uniToken1, amntIn.toNumber())
        )
        setAmntOut(expectedAmountOut ?? amountOut)
      } catch (err) {
        console.error('No tick data provider was given')
      }
    })()
  }, [pool, routes[0]])

  return useMemo(() => {
    if (!amountIn || !currencyOut || !pool) {
      return {
        state: V3TradeState.INVALID,
        trade: null,
      }
    }

    if (routesLoading || !amntOut) {
      return {
        state: V3TradeState.LOADING,
        trade: null,
      }
    }

    // const { bestRoute, amountOut } = quotesResults.reduce(
    //   (currentBest: { bestRoute: Route<Currency, Currency> | null; amountOut: BigNumber | null }, { result }, i) => {
    //     if (!result) return currentBest

    //     if (currentBest.amountOut === null) {
    //       return {
    //         bestRoute: routes[i],
    //         amountOut: result.amountOut,
    //       }
    //     } else if (currentBest.amountOut.lt(result.amountOut)) {
    //       return {
    //         bestRoute: routes[i],
    //         amountOut: result.amountOut,
    //       }
    //     }

    //     return currentBest
    //   },
    //   {
    //     bestRoute: null,
    //     amountOut: null,
    //   }
    // )

    // if (!bestRoute || !amountOut) {
    //   return {
    //     state: V3TradeState.NO_ROUTE_FOUND,
    //     trade: null,
    //   }
    // }

    // const isSyncing = quotesResults.some(({ syncing }) => syncing)

    return {
      state: V3TradeState.VALID,
      trade: {
        route: routes[0],
        inputAmount: amountIn,
        outputAmount: amntOut,
      },
      // trade: Trade.createUncheckedTrade({
      //   route: bestRoute,
      //   tradeType: TradeType.EXACT_INPUT,
      //   inputAmount: amountIn,
      //   outputAmount: CurrencyAmount.fromRawAmount(currencyOut, amountOut.toString()),
      // }),
    }
  }, [amountIn, currencyOut, amntOut, routes, routesLoading, pool])
}

// /**
//  * Returns the best v3 trade for a desired exact output swap
//  * @param currencyIn the desired input currency
//  * @param amountOut the amount to swap out
//  */
// export function useBestV3TradeExactOut(
//   currencyIn?: Currency,
//   amountOut?: CurrencyAmount<Currency>
// ): { state: V3TradeState; trade: Trade<Currency, Currency, TradeType.EXACT_OUTPUT> | null } {
//   const quoter = useV3Quoter()
//   const { routes, loading: routesLoading } = useAllV3Routes(currencyIn, amountOut?.currency)

//   const quoteExactOutInputs = useMemo(() => {
//     return routes.map((route) => [
//       encodeRouteToPath(route, true),
//       amountOut ? `0x${amountOut.quotient.toString(16)}` : undefined,
//     ])
//   }, [amountOut, routes])

//   const quotesResults = useSingleContractMultipleData(quoter, 'quoteExactOutput', quoteExactOutInputs)

//   return useMemo(() => {
//     if (!amountOut || !currencyIn || quotesResults.some(({ valid }) => !valid)) {
//       return {
//         state: V3TradeState.INVALID,
//         trade: null,
//       }
//     }

//     if (routesLoading || quotesResults.some(({ loading }) => loading)) {
//       return {
//         state: V3TradeState.LOADING,
//         trade: null,
//       }
//     }

//     const { bestRoute, amountIn } = quotesResults.reduce(
//       (currentBest: { bestRoute: Route<Currency, Currency> | null; amountIn: BigNumber | null }, { result }, i) => {
//         if (!result) return currentBest

//         if (currentBest.amountIn === null) {
//           return {
//             bestRoute: routes[i],
//             amountIn: result.amountIn,
//           }
//         } else if (currentBest.amountIn.gt(result.amountIn)) {
//           return {
//             bestRoute: routes[i],
//             amountIn: result.amountIn,
//           }
//         }

//         return currentBest
//       },
//       {
//         bestRoute: null,
//         amountIn: null,
//       }
//     )

//     if (!bestRoute || !amountIn) {
//       return {
//         state: V3TradeState.NO_ROUTE_FOUND,
//         trade: null,
//       }
//     }

//     const isSyncing = quotesResults.some(({ syncing }) => syncing)

//     return {
//       state: isSyncing ? V3TradeState.SYNCING : V3TradeState.VALID,
//       trade: Trade.createUncheckedTrade({
//         route: bestRoute,
//         tradeType: TradeType.EXACT_OUTPUT,
//         inputAmount: CurrencyAmount.fromRawAmount(currencyIn, amountIn.toString()),
//         outputAmount: amountOut,
//       }),
//     }
//   }, [amountOut, currencyIn, quotesResults, routes, routesLoading])
// }
