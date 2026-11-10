
import { useState, useEffect, useCallback } from 'react'
import gunService from '../services/gunService'

// Cache data katalog selama 60 detik
const queryCache = new Map()
const CACHE_DURATION = 60 * 1000

export function useGuns(params = {}) {
  const paramKey = JSON.stringify(params)

  const [guns, setGuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [cacheHit, setCacheHit] = useState(false)

  const fetchGuns = useCallback(async (force = false) => {
    try {
      setError(null)

      const cached = queryCache.get(paramKey)

      // Gunakan cache jika masih berlaku
      if (
        !force &&
        cached &&
        Date.now() - cached.timestamp < CACHE_DURATION
      ) {
        setGuns(cached.data)
        setPagination(cached.pagination)
        setCacheHit(true)
        setLoading(false)
        return
      }

      setLoading(true)
      setCacheHit(false)

      const response = await gunService.getGuns(
        JSON.parse(paramKey)
      )

      if (response.success) {
        const data = response.data || []
        const pageInfo = response.pagination || null

        setGuns(data)
        setPagination(pageInfo)

        // Simpan hasil request ke cache
        queryCache.set(paramKey, {
          data,
          pagination: pageInfo,
          timestamp: Date.now(),
        })
      } else {
        setError(response.message || 'Failed to fetch products.')
      }
    } catch (err) {
      setError(err.message || 'An error occurred.')
      setGuns([])
    } finally {
      setLoading(false)
    }
  }, [paramKey])

  useEffect(() => {
    fetchGuns()
  }, [fetchGuns])

  const refetch = useCallback(() => {
    return fetchGuns(true)
  }, [fetchGuns])

  return {
    guns,
    loading,
    error,
    pagination,
    refetch,
    cacheHit,
  }
}

// Panggil setelah data katalog mengalami perubahan
export function clearGunsCache() {
  queryCache.clear()
}
