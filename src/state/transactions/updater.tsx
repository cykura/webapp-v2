import { useCallback, useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from 'state/hooks'
import { SupportedChainId } from '../../constants/chains'
import { useActiveWeb3ReactSol } from '../../hooks/web3'
import { retry, RetryableError, RetryOptions } from '../../utils/retry'
import { updateBlockNumber } from '../application/actions'
import { useAddPopup, useBlockNumber } from '../application/hooks'
import { checkedTransaction, finalizeTransaction } from './actions'

interface TxInterface {
  addedTime: number
  receipt?: Record<string, any>
  lastCheckedBlockNumber?: number
}

export function shouldCheck(lastBlockNumber: number, tx: TxInterface): boolean {
  if (tx.receipt) return false
  if (!tx.lastCheckedBlockNumber) return true
  const blocksSinceCheck = lastBlockNumber - tx.lastCheckedBlockNumber
  if (blocksSinceCheck < 1) return false
  const minutesPending = (new Date().getTime() - tx.addedTime) / 1000 / 60
  if (minutesPending > 60) {
    // every 10 blocks if pending for longer than an hour
    return blocksSinceCheck > 9
  } else if (minutesPending > 5) {
    // every 3 blocks if pending more than 5 minutes
    return blocksSinceCheck > 2
  } else {
    // otherwise every block
    return true
  }
}

const RETRY_OPTIONS_BY_CHAIN_ID: { [chainId: number]: RetryOptions } = {
  [SupportedChainId.ARBITRUM_ONE]: { n: 10, minWait: 250, maxWait: 1000 },
}
const DEFAULT_RETRY_OPTIONS: RetryOptions = { n: 3, minWait: 1000, maxWait: 3000 }

export default function Updater(): null {
  return null
}
