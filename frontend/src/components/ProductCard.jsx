import { useState } from 'react'
import { Link } from 'react-router-dom'
import ImageSlot from './ImageSlot.jsx'
import Stars from './Stars.jsx'
import { useCart } from '../context/CartContext.jsx'
import { eur } from '../lib/format.js'
import { CATEGORIES } from '../data/products.js'

export default function ProductCard({ product }) {
  const { addItem, getAvailableStock } = useCart()
  const cat = CATEGORIES.find((c) => c.slug === product.category)
  const [added, setAdded] = useState(false)
  const stock = getAvailableStock(product.id)
  const badge = product.badge?.startsWith('Últimas')
    ? (stock > 0 ? `Últimas ${stock}` : 'Agotado')
    : product.badge

  const handleAddToCart = () => {
    if (!addItem(product, 1)) return

    setAdded(true)

    setTimeout(() => {
      setAdded(false)
    }, 1200)
  }

  return (
    <article className="card">
      <Link to={`/producto/${product.slug}`} className="card-media">
        <ImageSlot
          src={product.image}
          alt={`${product.brand} ${product.name}`}
        />

        {badge && (
          <span
            className={`badge ${
              badge.startsWith('Últimas') || badge === 'Agotado'
                ? 'badge-dark badge-right'
                : ''
            }`}
          >
            {badge}
          </span>
        )}
      </Link>

      <div className="card-body">
        <div className="card-top">
          <span className="card-cat">{cat?.nombre}</span>
          <Stars
            rating={product.rating}
            reviews={product.reviews}
          />
        </div>

        <span className="card-brand">{product.brand}</span>

        <Link
          to={`/producto/${product.slug}`}
          className="card-name"
        >
          {product.name}
        </Link>

        <div className="card-availability">
          <p className={`card-stock ${stock <= 5 ? 'low' : ''}`}><span>Stock</span><strong>{stock}</strong></p>
          {product.variants?.length > 0 && <span className="variant-count">{product.variants.length + 1} {product.finish ? 'acabados' : 'colores'}</span>}
        </div>
        <div className="card-bottom">
          <span className="price">{eur(product.price)}</span>

          <button
            className={`btn btn-sm ${added ? 'added' : 'btn-dark'}`}
            onClick={handleAddToCart}
            disabled={stock === 0}
          >
            {added ? '✓ Añadido' : '+ Carrito'}
          </button>
        </div>
      </div>
    </article>
  )
}
