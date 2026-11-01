import { useMemo, useState, useRef, useLayoutEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Grid2X2, List } from 'lucide-react'
import ProductCard from '../components/ProductCard.jsx'
import { CATEGORIES } from '../data/products.js'
import { useProducts } from '../context/ProductsContext.jsx'

export default function Catalogo() {
  const { categoria } = useParams()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState('grid')
  const { products: productosBackend } = useProducts()

  const pending = useRef(params)

  useLayoutEffect(() => {
    pending.current = params
  }, [params])

  const q = params.get('q') ?? ''
  const sort = params.get('orden') ?? 'destacados'
  const brand = params.get('marca') ?? ''

  const min = Math.max(
    0,
    Number(params.get('min')) || 0
  )

  const max = Math.max(
    0,
    Number(params.get('max') ?? 700) || 0
  )

  const current = CATEGORIES.find(
    (c) => c.slug === categoria
  )

  const update = (key, value) => {
    const next = new URLSearchParams(pending.current)

    if (value === '') {
      next.delete(key)
    } else {
      next.set(key, value)
    }

    pending.current = next
    setParams(next, { replace: true })
  }

  // Filtrar y ordenar productos recibidos desde el backend
  const products = useMemo(() => {
    const list = productosBackend.filter(
      (p) =>
        (!categoria || p.category === categoria) &&
        (!brand || p.brand === brand) &&
        p.price >= min &&
        p.price <= max &&
        `${p.brand} ${p.name} ${p.category}`
          .toLowerCase()
          .includes(q.toLowerCase())
    )

    if (sort === 'precio-asc') {
      list.sort((a, b) => a.price - b.price)
    } else if (sort === 'precio-desc') {
      list.sort((a, b) => b.price - a.price)
    } else if (sort === 'valoracion') {
      list.sort((a, b) => b.rating - a.rating)
    } else {
      list.sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured)
      )
    }

    return list
  }, [
    productosBackend,
    categoria,
    brand,
    min,
    max,
    q,
    sort
  ])

  // Marcas disponibles según los productos del backend
  const brands = useMemo(() => {
    return [...new Set(productosBackend.map((p) => p.brand))]
      .sort()
  }, [productosBackend])

  return (
    <section className="section page-top">
      <div className="container">

        <nav className="breadcrumb" aria-label="Ruta">
          <Link to="/">Inicio</Link> /{' '}
          <span>{current?.nombre ?? 'Catálogo'}</span>
        </nav>

        <div className="section-head">
          <h1 className="h-xl">
            {current?.nombre ?? 'Catálogo'}
          </h1>

          <p className="lead">
            {current?.descripcion ??
              'Audio diseñado para escuchar, coleccionar y disfrutar.'}
          </p>
        </div>

        <div className="catalog-layout">

          {/* FILTROS */}
          <aside
            className="filters"
            aria-label="Filtros de productos"
          >

            <div className="filter-group">
              <h2>Categoría</h2>

              <Link
                className={!categoria ? 'selected' : ''}
                to={`/catalogo?${params}`}
              >
                Todas las categorías
              </Link>

              {CATEGORIES.map((c) => (
                <Link
                  className={
                    categoria === c.slug
                      ? 'selected'
                      : ''
                  }
                  key={c.slug}
                  to={`/catalogo/${c.slug}?${params}`}
                >
                  {c.nombre}
                </Link>
              ))}
            </div>

            <div className="filter-group">
              <h2>Marca</h2>

              <button
                className={!brand ? 'selected' : ''}
                onClick={() => update('marca', '')}
              >
                Todas las marcas
              </button>

              {brands.map((b) => (
                <button
                  key={b}
                  className={
                    brand === b ? 'selected' : ''
                  }
                  onClick={() => update('marca', b)}
                >
                  {b}
                </button>
              ))}
            </div>

            <div className="filter-group">
              <h2>Precio</h2>

              <label htmlFor="price-max">
                Precio máximo: {max} €
              </label>

              <input
                id="price-max"
                type="range"
                min="0"
                max="700"
                step="1"
                value={max}
                onChange={(e) =>
                  update('max', e.target.value)
                }
              />

              <div className="price-inputs">

                <label>
                  Desde (€)
                  <input
                    aria-label="Precio mínimo"
                    type="number"
                    min="0"
                    max="700"
                    value={min}
                    onChange={(e) =>
                      update('min', e.target.value)
                    }
                  />
                </label>

                <label>
                  Hasta (€)
                  <input
                    aria-label="Precio máximo"
                    type="number"
                    min="0"
                    max="700"
                    value={max}
                    onChange={(e) =>
                      update('max', e.target.value)
                    }
                  />
                </label>

              </div>
            </div>

            <Link
              className="text-button"
              to="/catalogo"
            >
              Limpiar filtros
            </Link>

          </aside>

          {/* RESULTADOS */}
          <div className="catalog-results">

            <div className="catalog-search">
              <label htmlFor="catalog-search">
                Buscar producto o marca
              </label>

              <input
                id="catalog-search"
                type="search"
                value={q}
                onChange={(e) =>
                  update('q', e.target.value)
                }
                placeholder="Tocadiscos, Sony, vinilos…"
              />
            </div>

            <div className="toolbar">

              <p
                className="muted"
                role="status"
              >
                {products.length} productos
              </p>

              <div className="result-actions">

                <select
                  aria-label="Ordenar productos"
                  value={sort}
                  onChange={(e) =>
                    update('orden', e.target.value)
                  }
                >
                  <option value="destacados">
                    Destacados
                  </option>

                  <option value="precio-asc">
                    Precio: menor a mayor
                  </option>

                  <option value="precio-desc">
                    Precio: mayor a menor
                  </option>

                  <option value="valoracion">
                    Mejor valorados
                  </option>
                </select>

                <button
                  className="view-button"
                  aria-label="Vista en cuadrícula"
                  aria-pressed={view === 'grid'}
                  onClick={() => setView('grid')}
                >
                  <Grid2X2 size={17} />
                </button>

                <button
                  className="view-button"
                  aria-label="Vista en lista"
                  aria-pressed={view === 'list'}
                  onClick={() => setView('list')}
                >
                  <List size={17} />
                </button>

              </div>
            </div>

            {products.length ? (

              <div
                className={`product-grid catalog-grid ${
                  view === 'list' ? 'list-view' : ''
                }`}
              >
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                  />
                ))}
              </div>

            ) : (

              <div className="empty">

                <h2 className="h-md">
                  Sin resultados
                </h2>

                <p>
                  {min > max
                    ? 'El precio mínimo supera al máximo.'
                    : 'Prueba otra búsqueda o amplía el rango de precio.'}
                </p>

                <Link
                  to="/catalogo"
                  className="btn btn-dark"
                >
                  Limpiar filtros
                </Link>

              </div>

            )}

          </div>
        </div>
      </div>
    </section>
  )
}