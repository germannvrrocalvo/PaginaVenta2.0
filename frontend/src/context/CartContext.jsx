import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useProducts } from './ProductsContext.jsx'
import { trackEvent } from '../lib/events.js'

const CART_KEY = 'ucam_cart'
const CartContext = createContext(null)

const inventoryKey = (productId, variantId = null) => variantId ? `${productId}:${variantId}` : productId

function readJson(key, fallback) {
  try {
    return JSON.parse(sessionStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

export const useCart = () => useContext(CartContext)

export function CartProvider({ children }) {
  const { products, refreshProducts } = useProducts()
  const [items, setItems] = useState(() => {
    const saved = readJson(CART_KEY, [])
    if (!Array.isArray(saved)) return []
    return saved.filter((item) => item && typeof item === 'object').map((item) => {
      const itemWithoutLegacyVariant = { ...item }
      delete itemWithoutLegacyVariant.color
      delete itemWithoutLegacyVariant.colorHex
      delete itemWithoutLegacyVariant.finish
      const productId = item.productId ?? item.id
      const variantId = item.variantId ?? null
      const product = products.find((candidate) => candidate.id === productId)
      const variant = product?.variants?.find((candidate) => candidate.id === variantId)
      const variantType = product?.finish ? 'Acabado' : product?.color ? 'Color' : item.variantType ?? null
      const variantValue = variant?.finish ?? variant?.color ?? product?.finish ?? product?.color ?? item.variantValue ?? item.finish ?? item.color ?? null
      return {
        ...itemWithoutLegacyVariant,
        productId,
        cartKey: item.cartKey ?? item.id,
        variantId,
        variantType,
        variantValue,
      }
    })
  })
  const [notice, setNotice] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const noticeTimer = useRef(null)

  useEffect(() => {
    sessionStorage.setItem(CART_KEY, JSON.stringify(items))
  }, [items])

  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  const getAvailableStock = (productId, variantId = null) => {
    const product = products.find((candidate) => candidate.id === productId)
    const variant = product?.variants?.find((candidate) => candidate.id === variantId)
    return variantId ? (variant?.stock ?? 0) : (product?.stock ?? 0)
  }

  const showNotice = (item) => {
    clearTimeout(noticeTimer.current)
    setNotice(item)
    noticeTimer.current = setTimeout(() => setNotice(null), 3500)
  }

  const addItem = (product, qty = 1, variant = null) => {
    const variantId = variant?.id ?? null
    const availableStock = getAvailableStock(product.id, variantId)
    if (availableStock < 1 || !Number.isFinite(qty) || qty < 1) return false

    const cartKey = inventoryKey(product.id, variantId)
    const safeQty = Math.floor(qty)
    const variantType = product.finish ? 'Acabado' : product.color ? 'Color' : null
    const variantValue = variant?.finish ?? variant?.color ?? product.finish ?? product.color ?? null
    const sku = variant?.sku ?? product.sku

    setItems((previous) => {
      const existing = previous.find((item) => item.cartKey === cartKey)
      if (existing) {
        return previous.map((item) => item.cartKey === cartKey
          ? { ...item, qty: Math.min(item.qty + safeQty, availableStock), stock: availableStock }
          : item)
      }
      return [...previous, {
        id: cartKey,
        cartKey,
        productId: product.id,
        variantId,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        price: product.price,
        image: variant?.image ?? product.image,
        variantType,
        variantValue,
        sku,
        stock: availableStock,
        qty: Math.min(safeQty, availableStock),
      }]
    })

    showNotice({ name: product.name, variantType, variantValue })
    trackEvent('cart.item_added', { productId: product.id, sku, variantId, variantType, variantValue, qty: safeQty, price: product.price })
    return true
  }

  const setQty = (cartKey, qty) => setItems((previous) => previous.map((item) => {
    if (item.cartKey !== cartKey) return item
    const availableStock = getAvailableStock(item.productId, item.variantId)
    return { ...item, stock: availableStock, qty: Math.max(1, Math.min(qty, availableStock)) }
  }))

  const removeItem = (cartKey) => setItems((previous) => previous.filter((item) => item.cartKey !== cartKey))
  const clear = () => setItems([])
  const completePurchase = async () => {
    setItems([])
    setNotice(null)
    setCartOpen(false)
    await refreshProducts()
  }
  const count = items.reduce((total, item) => total + item.qty, 0)

  return (
    <CartContext.Provider value={{
      items,
      count,
      notice,
      cartOpen,
      addItem,
      setQty,
      removeItem,
      clear,
      completePurchase,
      getAvailableStock,
      openCart: () => { setCartOpen(true); setNotice(null) },
      closeCart: () => setCartOpen(false),
      toggleCart: () => { setCartOpen((open) => !open); setNotice(null) },
      dismissNotice: () => setNotice(null),
    }}>
      {children}
    </CartContext.Provider>
  )
}
