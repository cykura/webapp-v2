import type { Network } from '@saberhq/solana-contrib'

export enum ExplorerDataType {
  TRANSACTION = 'tx',
  TOKEN = 'address',
  ADDRESS = 'address',
  BLOCK = 'block',
}

export function getExplorerLink(network: Network, data: string, type: ExplorerDataType) {
  let uri = `https://explorer.solana.com/${type}/${data}/?cluster=`

  if (network == 'localnet') {
    uri += 'custom&customUrl=http://localhost:8899'
  } else {
    uri += network
  }
  return uri
}
