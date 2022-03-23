import { useEffect, useMemo } from 'react'
import { useActiveWeb3ReactSol } from '../../hooks/web3'
import { useBlockNumber } from '../application/hooks'
import { useAppDispatch, useAppSelector } from '../hooks'
import { fetchedLogs, fetchedLogsError, fetchingLogs } from './slice'
import { EventFilter, keyToFilter } from './utils'

export default function Updater(): null {
  const dispatch = useAppDispatch()
  const state = useAppSelector((state) => state.logs)
  const { chainId, librarySol } = useActiveWeb3ReactSol()

  const blockNumber = useBlockNumber()

  const filtersNeedFetch: EventFilter[] = useMemo(() => {
    if (!chainId || typeof blockNumber !== 'number') return []

    const active = state[chainId]
    if (!active) return []

    return Object.keys(active)
      .filter((key) => {
        const { fetchingBlockNumber, results, listeners } = active[key]
        if (listeners === 0) return false
        if (typeof fetchingBlockNumber === 'number' && fetchingBlockNumber >= blockNumber) return false
        if (results && typeof results.blockNumber === 'number' && results.blockNumber >= blockNumber) return false
        return true
      })
      .map((key) => keyToFilter(key))
  }, [blockNumber, chainId, state])

  useEffect(() => {
    if (!librarySol || !chainId || typeof blockNumber !== 'number' || filtersNeedFetch.length === 0) return

    dispatch(fetchingLogs({ chainId, filters: filtersNeedFetch, blockNumber }))
    filtersNeedFetch.forEach((filter) => filter)
  }, [blockNumber, chainId, dispatch, filtersNeedFetch, librarySol])

  return null
}
