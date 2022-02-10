// a list of tokens by chain
import { Currency, Token } from '@uniswap/sdk-core'
import { SupportedChainId } from './chains'
import {
  AMPL,
  DAI,
  ExtendedEther,
  FEI,
  FRAX,
  FXS,
  MIR,
  renBTC,
  TRIBE,
  UMA,
  UNI,
  USDC,
  USDT,
  UST,
  WBTC,
  ETH2X_FLI,
  WETH9_EXTENDED,
  SOLCYS,
  SOLUSDT,
  SOLUSDC,
  SOL_LOCAL,
  SOLUSDT_LOCAL,
  SOLUSDC_LOCAL,
  SOLUSDT_MAIN,
  SOLUSDC_MAIN,
} from './tokens'

type ChainTokenList = {
  readonly [chainId: number]: Token[]
}

type ChainCurrencyList = {
  readonly [chainId: number]: Currency[]
}

const WETH_ONLY: ChainTokenList = {
  [SupportedChainId.MAINNET]: [WETH9_EXTENDED[SupportedChainId.MAINNET]],
  [SupportedChainId.ROPSTEN]: [WETH9_EXTENDED[SupportedChainId.ROPSTEN]],
  [SupportedChainId.RINKEBY]: [WETH9_EXTENDED[SupportedChainId.RINKEBY]],
  [SupportedChainId.GOERLI]: [WETH9_EXTENDED[SupportedChainId.GOERLI]],
  [SupportedChainId.KOVAN]: [WETH9_EXTENDED[SupportedChainId.KOVAN]],
  [SupportedChainId.ARBITRUM_ONE]: [WETH9_EXTENDED[SupportedChainId.ARBITRUM_ONE]],
}
// used to construct intermediary pairs for trading
export const BASES_TO_CHECK_TRADES_AGAINST: ChainTokenList = {
  [104]: [SOLUSDT_LOCAL, SOLUSDC_LOCAL],
  [103]: [SOLUSDT, SOLUSDC, SOLCYS],
  [101]: [SOLUSDT_MAIN, SOLUSDC_MAIN],
}
export const ADDITIONAL_BASES: { [chainId: number]: { [tokenAddress: string]: Token[] } } = {
  [1]: {
    '0xF16E4d813f4DcfDe4c5b44f305c908742De84eF0': [ETH2X_FLI],
    '0xA948E86885e12Fb09AfEF8C52142EBDbDf73cD18': [UNI[1]],
    '0x561a4717537ff4AF5c687328c0f7E90a319705C0': [UNI[1]],
    '0xE0360A9e2cdd7d03B9408c7D3001E017BAc2EcD5': [UNI[1]],
    '0xa6e3454fec677772dd771788a079355e43910638': [UMA],
    '0xB46F57e7Ce3a284d74b70447Ef9352B5E5Df8963': [UMA],
    [FEI.address]: [TRIBE],
    [TRIBE.address]: [FEI],
    [FRAX.address]: [FXS],
    [FXS.address]: [FRAX],
    [WBTC.address]: [renBTC],
    [renBTC.address]: [WBTC],
  },
}
/**
 * Some tokens can only be swapped via certain pairs, so we override the list of bases that are considered for these
 * tokens.
 */
export const CUSTOM_BASES: { [chainId: number]: { [tokenAddress: string]: Token[] } } = {
  [1]: {
    [AMPL.address]: [DAI, WETH9_EXTENDED[1]],
  },
}

/**
 * Shows up in the currency select for swap and add liquidity
 */
export const COMMON_BASES: ChainCurrencyList = {
  // [1]: [ExtendedEther.onChain(1), DAI, USDC, USDT],
  [104]: [SOLUSDT_LOCAL, SOLUSDC_LOCAL],
  [103]: [SOLUSDT, SOLUSDC],
  [101]: [SOLUSDT_MAIN, SOLUSDC_MAIN],
}

// used to construct the list of all pairs we consider by default in the frontend
export const BASES_TO_TRACK_LIQUIDITY_FOR: ChainTokenList = {
  ...WETH_ONLY,
  [1]: [...WETH_ONLY[1], DAI, USDC, USDT, WBTC],
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
