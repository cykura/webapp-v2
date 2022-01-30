import type { Network } from '@saberhq/solana-contrib'

export enum ExplorerDataType {
  TRANSACTION = 'tx',
  TOKEN = 'address',
  ADDRESS = 'address',
  BLOCK = 'block',
}

export function getExplorerLink(network: Network, data = 'dummyData', type: ExplorerDataType) {
  let uri = `https://explorer.solana.com/${type}/${data}/?cluster=`

  if (network == 'localnet') {
    uri += 'custom&customUrl=http%3A%2F%2Flocalhost%3A8899'
  } else {
    uri += network
  }
  return uri
}
