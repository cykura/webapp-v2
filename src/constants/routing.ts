// a list of tokens by chain
import { Currency, Token } from '@cykura/sdk-core'
import { SOLCYS_LOCAL, SOLUSDT_LOCAL, SOLUSDC_LOCAL, SOLUSDT_MAIN, SOLUSDC_MAIN, WSOL_LOCAL, CYS_MAIN } from './tokens'

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
