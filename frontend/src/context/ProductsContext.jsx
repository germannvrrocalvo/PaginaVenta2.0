import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { obtenerProductos } from '../services/productos.js'

// Único punto donde se pide el catálogo al backend. El resto de la web lo lee de aquí.
const ProductsContext = createContext(null)

export const useProducts = () => useContext(ProductsContext)

export function ProductsProvider({ children }) {
  const [products, setProducts] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const refreshProducts = useCallback(async () => {
    try {
      const list = await obtenerProductos()
      setProducts(list)
      setError('')
      return list
    } catch (loadError) {
      setError(loadError.message)
      throw loadError
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    obtenerProductos()
      .then((list) => {
        if (!cancelled) {
          setProducts(list)
          setError('')
        }
      })
      .catch((e) => {
        console.error('Error conectando con el backend:', e)
        if (!cancelled) setError(e.message)
      })
    return () => { cancelled = true }
  }, [attempt])

  const retry = () => { setError(''); setAttempt((n) => n + 1) }

  if (!products) {
    return (
      <div className="container empty" role={error ? 'alert' : 'status'}>
        {error ? (
          <>
            <h2>No se pudieron cargar los productos</h2>
            <p>Comprueba que el backend esté iniciado (npm start en la carpeta backend).</p>
            <p>Detalle: {error}</p>
            <button className="btn btn-dark" type="button" onClick={retry}>Reintentar</button>
          </>
        ) : (
          <h2>Cargando…</h2>
        )}
      </div>
    )
  }

  return <ProductsContext.Provider value={{ products, refreshProducts }}>{children}</ProductsContext.Provider>
}