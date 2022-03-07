// a list of tokens by chain
import { Currency, Token } from '@cykura/sdk-core'
import {
  DAI,
  USDC,
  USDT,
  WBTC,
  SOLCYS_LOCAL,
  SOLUSDT_LOCAL,
  SOLUSDC_LOCAL,
  SOLUSDT_MAIN,
  SOLUSDC_MAIN,
  WSOL_LOCAL,
  CYS_MAIN,
} from './tokens'

type ChainTokenList = {
  readonly [chainId: number]: Token[]
}

type ChainCurrencyList = {
  readonly [chainId: number]: Currency[]
}

// used to construct intermediary pairs for trading
export const BASES_TO_CHECK_TRADES_AGAINST: ChainTokenList = {
  // Need to use USDT as a base too
  [104]: [SOLUSDC_LOCAL, SOLUSDT_LOCAL],
  [103]: [SOLUSDT_LOCAL, SOLUSDC_LOCAL],
  [101]: [SOLUSDC_MAIN],
}

/**
 * Some tokens can only be swapped via certain pairs, so we override the list of bases that are considered for these
 * tokens.
 */
export const CUSTOM_BASES: { [chainId: number]: { [tokenAddress: string]: Token[] } } = {}

/**
 * Shows up in the currency select for swap and add liquidity
 */
export const COMMON_BASES: ChainCurrencyList = {
  [104]: [SOLUSDT_LOCAL, SOLUSDC_LOCAL, SOLCYS_LOCAL, WSOL_LOCAL],
  [103]: [SOLUSDT_LOCAL, SOLUSDC_LOCAL],
  [101]: [SOLUSDT_MAIN, SOLUSDC_MAIN, CYS_MAIN, WSOL_LOCAL],
}

// used to construct the list of all pairs we consider by default in the frontend
export const BASES_TO_TRACK_LIQUIDITY_FOR: ChainTokenList = {
  [1]: [DAI, USDC, USDT, WBTC],
}
export const PINNED_PAIRS: { readonly [chainId: number]: [Token, Token][] } = {
  [1]: [
    [
      new Token(1, '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643', 8, 'cDAI', 'Compound Dai'),
      new Token(1, '0x39AA39c021dfbaE8faC545936693aC917d5E7563', 8, 'cUSDC', 'Compound USD Coin'),
    ],
    [USDC, USDT],
    [DAI, USDT],
  ],
}
