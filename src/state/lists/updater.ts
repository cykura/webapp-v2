import { useAllLists } from 'state/lists/hooks'
import { useEffect } from 'react'

import { useFetchListCallback } from '../../hooks/useFetchListCallback'

export default function Updater(): null {
  // get all loaded lists, and the active urls
  const lists = useAllLists()

  const fetchList = useFetchListCallback()

  // whenever a list is not loaded and not loading, try again to load it
  useEffect(() => {
    Object.keys(lists).forEach((listUrl) => {
      const list = lists[listUrl]
      if (!list.current && !list.loadingRequestId && !list.error) {
        fetchList(listUrl).catch((error) => console.debug('list added fetching error', error))
      }
    })
  }, [fetchList, lists])

  return null
}
