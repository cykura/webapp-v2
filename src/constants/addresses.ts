import { PublicKey } from '@solana/web3.js'
import { FACTORY_ADDRESS as V3_FACTORY_ADDRESS } from '@uniswap/v3-sdk'
import { constructSameAddressMap } from '../utils/constructSameAddressMap'
import { SupportedChainId } from './chains'

type AddressMap = { [chainId: number]: string }

export const UNI_ADDRESS: AddressMap = constructSameAddressMap('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984')
export const MULTICALL_ADDRESS: AddressMap = {
  ...constructSameAddressMap('0x1F98415757620B543A52E61c46B32eB19261F984'),
  [SupportedChainId.ARBITRUM_RINKEBY]: '0xa501c031958F579dB7676fF1CE78AD305794d579',
  [SupportedChainId.ARBITRUM_ONE]: '0xadF885960B47eA2CD9B55E6DAc6B42b7Cb2806dB',
}

export const V3_CORE_FACTORY_ADDRESSES: AddressMap = constructSameAddressMap(V3_FACTORY_ADDRESS, [
  SupportedChainId.ARBITRUM_ONE,
  SupportedChainId.ARBITRUM_RINKEBY,
])
export const QUOTER_ADDRESSES: AddressMap = constructSameAddressMap('0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6', [
  SupportedChainId.ARBITRUM_ONE,
  SupportedChainId.ARBITRUM_RINKEBY,
])
export const NONFUNGIBLE_POSITION_MANAGER_ADDRESSES: AddressMap = constructSameAddressMap(
  '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  [SupportedChainId.ARBITRUM_ONE, SupportedChainId.ARBITRUM_RINKEBY]
)

export const SWAP_ROUTER_ADDRESSES: AddressMap = constructSameAddressMap('0xE592427A0AEce92De3Edee1F18E0157C05861564', [
  SupportedChainId.ARBITRUM_ONE,
  SupportedChainId.ARBITRUM_RINKEBY,
])
export const V3_MIGRATOR_ADDRESSES: AddressMap = constructSameAddressMap('0xA5644E29708357803b5A882D272c41cC0dF92B34', [
  SupportedChainId.ARBITRUM_ONE,
  SupportedChainId.ARBITRUM_RINKEBY,
])

export const PROGRAM_ID_STR = 'cysGRNzZvgRxx9XgSDo3q5kqVTtvwxp2p3Bzs4K2LvX'
export const PROGRAM_ID = new PublicKey('cysGRNzZvgRxx9XgSDo3q5kqVTtvwxp2p3Bzs4K2LvX')

// Staking Addresses - Devnet addresses
export const STAKING_PROGRAM = new PublicKey('7XDST8WpuVzZpYqaoVsw5pYJ4NEqvFxkyegx4nK34FMP')
export const CYS_MINT = new PublicKey('BRLsMczKuaR5w9vSubF4j8HwEGGprVAyyVgS4EX7DKEg')

// No lock period
export const NO_LOCK_POOL = new PublicKey('C8CJc3Kj3C7eU216jwWUDde3DqPukcko9W39VN1Z99TX')
export const NO_LOCK_POOL_SIGNER = new PublicKey('8cwZrH7385Nv2TH4xB2qEgxjDsrEXxQ6QqGY2KJvSs6w')
export const NO_LOCK_NONCE = 252
export const NO_LOCK_STK_VAULT = new PublicKey('GvWrRhTHYQC2QNG4Hph2bRL5KUqrRoUVmapvzPst96HH')
export const NO_LOCK_REWARDS_VAULT = new PublicKey('2p9P2i1bdSXyeFHGKMHGb7ixoJDcbTEv6VggHrt7JavK')

// 2 months locking period
export const TM_LOCK_POOL = new PublicKey('J5YMQTPAbhiyVqYF9kyeWVknfwgciM56moRYXnk3wEcK')
export const TM_LOCK_POOL_SIGNER = new PublicKey('AcwwkAm1yCxcDKKDdogdoNSt6RzezN3qU4bjVYrG8vbg')
export const TM_LOCK_NONCE = 251
export const TM_LOCK_STK_VAULT = new PublicKey('HHvSez6nz1xC1d3E6sGEdXvn7bhsmQP5bGVf5Z7KRJXH')
export const TM_LOCK_REWARDS_VAULT = new PublicKey('EUCX4QrRZv6iNdnXMmsZfJK7668Rj2nYMpfzEM1w2JvH')

export enum PoolType {
  NOLOCK,
  TWOLOCK,
}
