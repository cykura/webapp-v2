import { PublicKey } from '@solana/web3.js'
import { WETH9, Token, Ether } from '@cykura/sdk-core'
import { UNI_ADDRESS } from './addresses'
import { SupportedChainId } from './chains'

export const AMPL = new Token(
  SupportedChainId.MAINNET,
  '0xD46bA6D942050d489DBd938a2C909A5d5039A161',
  9,
  'AMPL',
  'Ampleforth'
)
export const DAI = new Token(
  SupportedChainId.MAINNET,
  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  18,
  'DAI',
  'Dai Stablecoin'
)
export const USDC = new Token(
  SupportedChainId.MAINNET,
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  6,
  'USDC',
  'USD//C'
)
export const USDC_ARBITRUM = new Token(
  SupportedChainId.ARBITRUM_ONE,
  '0xe865dF68133fcEd7c2285ff3896B406CAfAa2dB8',
  6,
  'USDC',
  'USD//C'
)
export const USDT = new Token(
  SupportedChainId.MAINNET,
  '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  6,
  'USDT',
  'Tether USD'
)
export const WBTC = new Token(
  SupportedChainId.MAINNET,
  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  8,
  'WBTC',
  'Wrapped BTC'
)
export const FEI = new Token(
  SupportedChainId.MAINNET,
  '0x956F47F50A910163D8BF957Cf5846D573E7f87CA',
  18,
  'FEI',
  'Fei USD'
)
export const TRIBE = new Token(
  SupportedChainId.MAINNET,
  '0xc7283b66Eb1EB5FB86327f08e1B5816b0720212B',
  18,
  'TRIBE',
  'Tribe'
)
export const FRAX = new Token(
  SupportedChainId.MAINNET,
  '0x853d955aCEf822Db058eb8505911ED77F175b99e',
  18,
  'FRAX',
  'Frax'
)
export const FXS = new Token(
  SupportedChainId.MAINNET,
  '0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0',
  18,
  'FXS',
  'Frax Share'
)
export const renBTC = new Token(
  SupportedChainId.MAINNET,
  '0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D',
  8,
  'renBTC',
  'renBTC'
)
export const UMA = new Token(
  SupportedChainId.MAINNET,
  '0x04Fa0d235C4abf4BcF4787aF4CF447DE572eF828',
  18,
  'UMA',
  'UMA Voting Token v1'
)
export const ETH2X_FLI = new Token(
  SupportedChainId.MAINNET,
  '0xAa6E8127831c9DE45ae56bB1b0d4D4Da6e5665BD',
  18,
  'ETH2x-FLI',
  'ETH 2x Flexible Leverage Index'
)
// Mirror Protocol compat.
export const UST = new Token(
  SupportedChainId.MAINNET,
  '0xa47c8bf37f92abed4a126bda807a7b7498661acd',
  18,
  'UST',
  'Wrapped UST'
)
export const MIR = new Token(
  SupportedChainId.MAINNET,
  '0x09a3ecafa817268f77be1283176b946c4ff2e608',
  18,
  'MIR',
  'Wrapped MIR'
)
export const UNI: { [chainId: number]: Token } = {
  [SupportedChainId.MAINNET]: new Token(SupportedChainId.MAINNET, UNI_ADDRESS[1], 18, 'UNI', 'Uniswap'),
  [SupportedChainId.RINKEBY]: new Token(SupportedChainId.RINKEBY, UNI_ADDRESS[4], 18, 'UNI', 'Uniswap'),
  [SupportedChainId.ROPSTEN]: new Token(SupportedChainId.ROPSTEN, UNI_ADDRESS[3], 18, 'UNI', 'Uniswap'),
  [SupportedChainId.GOERLI]: new Token(SupportedChainId.GOERLI, UNI_ADDRESS[5], 18, 'UNI', 'Uniswap'),
  [SupportedChainId.KOVAN]: new Token(SupportedChainId.KOVAN, UNI_ADDRESS[42], 18, 'UNI', 'Uniswap'),
}

export const WETH9_EXTENDED: { [chainId: number]: Token } = {
  ...WETH9,
  [SupportedChainId.ARBITRUM_ONE]: new Token(
    SupportedChainId.ARBITRUM_ONE,
    '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [SupportedChainId.ARBITRUM_RINKEBY]: new Token(
    SupportedChainId.ARBITRUM_RINKEBY,
    '0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [SupportedChainId.OPTIMISM]: new Token(
    SupportedChainId.OPTIMISM,
    '0x4200000000000000000000000000000000000006',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [SupportedChainId.OPTIMISTIC_KOVAN]: new Token(
    SupportedChainId.OPTIMISTIC_KOVAN,
    '0x4200000000000000000000000000000000000006',
    18,
    'WETH',
    'Wrapped Ether'
  ),
}

export class ExtendedEther extends Ether {
  public get wrapped(): Token {
    if (this.chainId in WETH9_EXTENDED) return WETH9_EXTENDED[this.chainId]
    throw new Error('Unsupported chain ID')
  }

  private static _cachedEther: { [chainId: number]: ExtendedEther } = {}

  public static onChain(chainId: number): ExtendedEther {
    return this._cachedEther[chainId] ?? (this._cachedEther[chainId] = new ExtendedEther(chainId))
  }
}

// SOLANA TOKENS

export const SOLUSDC_MAIN = new Token(101, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 6, 'USDC', 'USD Coin')
export const SOLUSDT_MAIN = new Token(101, 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 6, 'USDT', 'USDT')
export const CYS_MAIN = new Token(101, 'BRLsMczKuaR5w9vSubF4j8HwEGGprVAyyVgS4EX7DKEg', 6, 'CYS', 'Cyclos')
export const WSOL_MAIN = new Token(101, 'So11111111111111111111111111111111111111112', 9, 'SOL', 'Wrapped SOL')

// SOLANA TOKENS

export const SOLUSDC = new Token(104, '5ihkgQGjKvWvmMtywTgLdwokZ6hqFv5AgxSyYoCNufQW', 6, 'USDC', 'USDC Coin')
export const SOLUSDT = new Token(104, '4cZv7KgYNgmr3NZSDhT5bhXGGttXKTndqyXeeC1cB6Xm', 6, 'USDT', 'USDT Coin')

// LOCALNET TOKENS

export const SOLUSDC_LOCAL = new Token(104, 'GyH7fsFCvD1Wt8DbUGEk6Hzt68SVqwRKDHSvyBS16ZHm', 6, 'USDC', 'USD Coin')
export const SOLUSDT_LOCAL = new Token(104, '7HvgZSj1VqsGADkpb8jLXCVqyzniDHP5HzQCymHnrn1t', 6, 'USDT', 'USDT')
export const SOL_LOCAL = new Token(104, 'EC1x3JZ1PBW4MqH711rqfERaign6cxLTBNb3mi5LK9vP', 9, 'wSOL', 'SOL')
export const WSOL_LOCAL = new Token(104, 'So11111111111111111111111111111111111111112', 9, 'SOL', 'Wrapped SOL')
export const SOLCYS_LOCAL = new Token(104, 'cxWg5RTK5AiSbBZh7NRg5btsbSrc8ETLXGf7tk3MUez', 6, 'CYS', 'Cyclos')

export const USDC_ICON =
  'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
export const USDT_ICON =
  'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg'
export const SOL_ICON = 'https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/solana/info/logo.png'
export const CYS_ICON =
  'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/BRLsMczKuaR5w9vSubF4j8HwEGGprVAyyVgS4EX7DKEg/logo.svg'

// TOKEN BUMPS

// Seed bumps
export const BITMAP_SEED = Buffer.from('b')
export const POOL_SEED = Buffer.from('p')
export const POSITION_SEED = Buffer.from('ps')
export const OBSERVATION_SEED = Buffer.from('o')
export const TICK_SEED = Buffer.from('t')
export const FEE_SEED = Buffer.from('f')
export const METADATA_SEED = Buffer.from('metadata')
