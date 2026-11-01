import { useEffect, useState } from 'react'
import { getOrder } from '../lib/orders.js'

export function useOrder(id, user, trackingToken = '') {
  const requestKey = `${id}:${user?.email ?? 'guest'}:${user?.role ?? 'guest'}:${trackingToken}`
  const [result, setResult] = useState({ key: null, order: null, error: '' })

  useEffect(() => {
    let cancelled = false
    getOrder(id, trackingToken)
      .then((order) => {
        if (!cancelled) setResult({ key: requestKey, order, error: '' })
      })
      .catch((error) => {
        if (!cancelled) setResult({ key: requestKey, order: null, error: error.message })
      })
    return () => { cancelled = true }
  }, [id, requestKey])

  if (result.key !== requestKey) {
    return { order: null, loading: true, error: '' }
  }
  return { order: result.order, loading: false, error: result.error }
}
