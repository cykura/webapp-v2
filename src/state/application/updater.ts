import { useCallback, useEffect, useState } from 'react'
// import { api, CHAIN_TAG } from 'state/data/enhanced'
import { useAppDispatch, useAppSelector } from 'state/hooks'
import { supportedChainId } from 'utils/supportedChainId'
import useDebounce from '../../hooks/useDebounce'
import useIsWindowVisible from '../../hooks/useIsWindowVisible'
import { useActiveWeb3ReactSol } from '../../hooks/web3'
import { updateBlockNumber, updateChainId } from './actions'

function useQueryCacheInvalidator() {
  const chainId = useAppSelector((state) => state.application.chainId)
  const dispatch = useAppDispatch()

  // useEffect(() => {
  //   dispatch(api.util.invalidateTags([CHAIN_TAG]))
  // }, [chainId, dispatch])
}

export default function Updater(): null {
  const { chainId, librarySol } = useActiveWeb3ReactSol()
  const dispatch = useAppDispatch()

  const windowVisible = useIsWindowVisible()

  const [state, setState] = useState<{ chainId: number | undefined; blockNumber: number | null }>({
    chainId,
    blockNumber: null,
  })

  useQueryCacheInvalidator()

  const blockNumberCallback = useCallback(
    (blockNumber: number) => {
      setState((state) => {
        if (chainId === state.chainId) {
          if (typeof state.blockNumber !== 'number') return { chainId, blockNumber }
          return { chainId, blockNumber: Math.max(blockNumber, state.blockNumber) }
        }
        return state
      })
    },
    [chainId, setState]
  )

  // attach/detach listeners
  useEffect(() => {
    if (!librarySol || !chainId || !windowVisible) return undefined

    setState({ chainId, blockNumber: null })

    // librarySol
    //   ?.getBlockNumber()
    //   .then(blockNumberCallback)
    //   .catch((error: any) => console.error(`Failed to get block number for chainId: ${chainId}`, error))

    // librarySol?.on('block', blockNumberCallback)
    return () => {
      // librarySol?.removeListener('block', blockNumberCallback)
    }
  }, [dispatch, chainId, librarySol, blockNumberCallback, windowVisible])

  const debouncedState = useDebounce(state, 100)

  useEffect(() => {
    if (!debouncedState.chainId || !debouncedState.blockNumber || !windowVisible) return
    dispatch(updateBlockNumber({ chainId: debouncedState.chainId, blockNumber: debouncedState.blockNumber }))
  }, [windowVisible, dispatch, debouncedState.blockNumber, debouncedState.chainId])

  useEffect(() => {
    dispatch(
      updateChainId({ chainId: debouncedState.chainId ? supportedChainId(debouncedState.chainId) ?? null : null })
    )
  }, [dispatch, debouncedState.chainId])

  return null
}
