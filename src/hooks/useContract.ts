import { Contract } from '@ethersproject/contracts'
import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { abi as MulticallABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/UniswapInterfaceMulticall.sol/UniswapInterfaceMulticall.json'

import { NONFUNGIBLE_POSITION_MANAGER_ADDRESSES, QUOTER_ADDRESSES, MULTICALL_ADDRESS } from 'constants/addresses'
import { abi as NFTPositionManagerABI } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import { useMemo } from 'react'
import { getContract } from 'utils'
import { useActiveWeb3ReactSol } from './web3'
import { SOLUSDC_LOCAL, SOLUSDT_LOCAL, SOL_LOCAL } from '../constants/tokens'

// returns null on errors
export function useContract<T extends Contract = Contract>(
  addressOrAddressMap: string | { [chainId: number]: string } | undefined,
  ABI: any,
  withSignerIfPossible = true
): T | null {
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
  if (SOLUSDC_LOCAL.address === tokenAddress) {
    return { ...SOLUSDC_LOCAL }
  } else if (SOLUSDT_LOCAL.address === tokenAddress) {
    return { ...SOLUSDT_LOCAL }
  } else {
    return { ...SOL_LOCAL }
  }
}

export function useMulticall2Contract() {
  return useContract(MULTICALL_ADDRESS, MulticallABI, false)
}

export function useV3NFTPositionManagerContract(withSignerIfPossible?: boolean) {
  return useContract(NONFUNGIBLE_POSITION_MANAGER_ADDRESSES, NFTPositionManagerABI, withSignerIfPossible)
}

export function useV3Quoter() {
  return useContract(QUOTER_ADDRESSES, QuoterABI)
}
