import { Contract } from '@ethersproject/contracts'
import { abi as MulticallABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/UniswapInterfaceMulticall.sol/UniswapInterfaceMulticall.json'
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESSES, MULTICALL_ADDRESS } from 'constants/addresses'
import { abi as NFTPositionManagerABI } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'

// returns null on errors
export function useContract<T extends Contract = Contract>(
  addressOrAddressMap: string | { [chainId: number]: string } | undefined,
  ABI: any,
  withSignerIfPossible = true
): T | null {
  return null
}

export function useMulticall2Contract() {
  return useContract(MULTICALL_ADDRESS, MulticallABI, false)
}

export function useV3NFTPositionManagerContract(withSignerIfPossible?: boolean) {
  return useContract(NONFUNGIBLE_POSITION_MANAGER_ADDRESSES, NFTPositionManagerABI, withSignerIfPossible)
}
