import { Contract } from '@ethersproject/contracts'
import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { abi as MulticallABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/UniswapInterfaceMulticall.sol/UniswapInterfaceMulticall.json'

import ENS_PUBLIC_RESOLVER_ABI from 'abis/ens-public-resolver.json'
import ENS_ABI from 'abis/ens-registrar.json'
import ERC20_BYTES32_ABI from 'abis/erc20_bytes32.json'
import WETH_ABI from 'abis/weth.json'
import EIP_2612 from 'abis/eip_2612.json'

import {
  NONFUNGIBLE_POSITION_MANAGER_ADDRESSES,
  QUOTER_ADDRESSES,
  MULTICALL_ADDRESS,
  ENS_REGISTRAR_ADDRESSES,
} from 'constants/addresses'
import { abi as NFTPositionManagerABI } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import { useMemo } from 'react'
import { Quoter, NonfungiblePositionManager, UniswapInterfaceMulticall } from 'types/v3'
import { getContract } from 'utils'
import { EnsPublicResolver, EnsRegistrar, Weth } from '../abis/types'
import { WETH9_EXTENDED } from '../constants/tokens'
import { useActiveWeb3ReactSol } from './web3'
import { SOLUSDC_LOCAL, SOLUSDT_LOCAL, SOL_LOCAL } from '../constants/tokens'

// returns null on errors
export function useContract<T extends Contract = Contract>(
  addressOrAddressMap: string | { [chainId: number]: string } | undefined,
  ABI: any,
  withSignerIfPossible = true
): T | null {
  /// Replace whole useActiveWeb3React() fully
  const { account, chainId, librarySol } = useActiveWeb3ReactSol()

  return useMemo(() => {
    if (!addressOrAddressMap || !ABI || !librarySol || !chainId) return null
    let address: string | undefined
    if (typeof addressOrAddressMap === 'string') address = addressOrAddressMap
    else address = addressOrAddressMap[chainId]
    if (!address) return null
    try {
      return getContract(address, ABI, librarySol, withSignerIfPossible && account ? account : undefined)
    } catch (error) {
      console.error('Failed to get contract', error)
      return null
    }
  }, [addressOrAddressMap, ABI, librarySol, chainId, withSignerIfPossible, account]) as T
}

export function useTokenContract(tokenAddress?: string, withSignerIfPossible?: boolean) {
  // return useContract<Erc20>(tokenAddress, ERC20_ABI, withSignerIfPossible)

  // returns Token details like name, symbol, decimals of the token itself
  // totalSupply is the supply of the pool
  // estimateGas(), approve(), allowance is also used which is not required for us
  // console.log(`Fetching details for ${tokenAddress}`)
  if (SOLUSDC_LOCAL.address === tokenAddress) {
    return { ...SOLUSDC_LOCAL }
  } else if (SOLUSDT_LOCAL.address === tokenAddress) {
    return { ...SOLUSDT_LOCAL }
  } else {
    return { ...SOL_LOCAL }
  }
}

export function useWETHContract(withSignerIfPossible?: boolean) {
  const { chainId } = useActiveWeb3ReactSol()
  return useContract<Weth>(chainId ? WETH9_EXTENDED[chainId]?.address : undefined, WETH_ABI, withSignerIfPossible)
}

export function useENSRegistrarContract(withSignerIfPossible?: boolean) {
  return useContract<EnsRegistrar>(ENS_REGISTRAR_ADDRESSES, ENS_ABI, withSignerIfPossible)
}

export function useENSResolverContract(address: string | undefined, withSignerIfPossible?: boolean) {
  return useContract<EnsPublicResolver>(address, ENS_PUBLIC_RESOLVER_ABI, withSignerIfPossible)
}

export function useBytes32TokenContract(tokenAddress?: string, withSignerIfPossible?: boolean): Contract | null {
  return useContract(tokenAddress, ERC20_BYTES32_ABI, withSignerIfPossible)
}

export function useEIP2612Contract(tokenAddress?: string): Contract | null {
  return useContract(tokenAddress, EIP_2612, false)
}

export function useMulticall2Contract() {
  return useContract<UniswapInterfaceMulticall>(MULTICALL_ADDRESS, MulticallABI, false) as UniswapInterfaceMulticall
}

export function useV3NFTPositionManagerContract(withSignerIfPossible?: boolean): NonfungiblePositionManager | null {
  return useContract<NonfungiblePositionManager>(
    NONFUNGIBLE_POSITION_MANAGER_ADDRESSES,
    NFTPositionManagerABI,
    withSignerIfPossible
  )
}

export function useV3Quoter() {
  return useContract<Quoter>(QUOTER_ADDRESSES, QuoterABI)
}
