import { Link } from 'react-router-dom'
import { ChevronRight, Music2, BadgeCheck, MonitorSpeaker, PackageCheck } from 'lucide-react'
import ImageSlot from '../components/ImageSlot.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { CATEGORIES } from '../data/products.js'
import { useProducts } from '../context/ProductsContext.jsx'

const WHY = [
  { icon: Music2, title: 'Sonido analógico', text: 'Seleccionamos cada producto por su calidad de sonido, no por su precio de venta.' },
  { icon: BadgeCheck, title: 'Selección especializada', text: 'Solo marcas con historial probado: Audio-Technica, Pro-Ject, Sennheiser, Klipsch.' },
  { icon: MonitorSpeaker, title: 'Compatibilidad garantizada', text: 'Cada producto indica con qué equipos es compatible, para que no tengas sorpresas.' },
  { icon: PackageCheck, title: 'Envío seguro', text: 'Embalaje específico para equipos de audio. Gratis en pedidos mayores de 300 €.' },
]

export default function Home() {
  const { products: productosBackend } = useProducts()
  const featured = productosBackend
    .filter((p) => p.featured)
    .slice(0, 4)

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Audio vintage premium</p>
            <h1>El sonido de<br /><em>otra época.</em></h1>
            <p className="hero-text">
              Descubre tocadiscos, vinilos y audio Hi-Fi para volver a escuchar la música como antes.
            </p>
            <div className="hero-actions">
              <Link to="/catalogo" className="btn btn-accent">Explorar catálogo</Link>
              <Link to="/catalogo/tocadiscos" className="btn btn-ghost">Ver tocadiscos</Link>
            </div>
          </div>
          {/* 👉 Imagen del hero: public/img/hero/hero.jpg */}

        </div>
      </section>

      {/* CATEGORÍAS */}
      <section className="section section-light">
        <div className="container">
          <div className="section-head center">
            <p className="eyebrow">Colección</p>
            <h2>Explora por categoría</h2>
          </div>
          <div className="cat-grid">
            {CATEGORIES.map((c) => (
              <Link key={c.slug} to={`/catalogo/${c.slug}`} className="cat-card">
                <ImageSlot className="cat-img" src={c.image} alt={c.nombre} />
                <div className="cat-overlay" />
                <div className="cat-content">
                  <h3>{c.nombre}</h3>
                  <p>{c.descripcion}</p>
                  <span className="cat-link">{c.cta} <ChevronRight size={15} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* DESTACADOS */}
      <section className="section section-cream">
        <div className="container">
          <div className="section-head row">
            <div>
              <p className="eyebrow">Destacados</p>
              <h2 className="h-xl">Selección UCAM Stereo</h2>
            </div>
            <Link to="/catalogo" className="see-all">Ver todo <ChevronRight size={16} /></Link>
          </div>
          <div className="product-grid">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* POR QUÉ */}
      <section className="section section-light">
        <div className="container">
          <div className="section-head center"><h2>Por qué UCAM Stereo</h2></div>
          <div className="why-grid">
            {WHY.map(({ icon: Icon, title, text }) => (
              <div key={title} className="why-item">
                <span className="why-icon"><Icon size={22} strokeWidth={1.6} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LA EXPERIENCIA */}
      <section className="section section-dark">
        <div className="container exp-grid">
          <div>
            <p className="eyebrow">La experiencia</p>
            <h2 className="h-xl light">Vuelve a poner<br />la aguja.</h2>
            <p className="exp-text">
              Escuchar música en vinilo no es solo una elección de sonido. Es un ritual. El crujido suave antes de que
              empiece la música, el calor analógico que los algoritmos no pueden replicar, la portada entre tus manos.
            </p>
            <Link to="/catalogo/vinilos" className="btn btn-accent">Descubrir vinilos</Link>
          </div>
          {/* 👉 Imagen: publichttps://images.unsplash.com/photo-1471478331149-c72f17e33c73?w=800&h=600&fit=crop&auto=format */}
          <ImageSlot className="exp-img" src="https://images.unsplash.com/photo-1471478331149-c72f17e33c73?w=800&h=600&fit=crop&auto=format" alt="Guitarra y vinilo" />
        </div>
      </section>
            {/* CTA FINAL */}
      <section className="home-cta">
        <div className="container home-cta-content">
          <h2>Empieza a escuchar de otra manera.</h2>

          <p>
            Más de 8 productos de audio seleccionados para que encuentres exactamente lo que necesitas.
          </p>

          <Link to="/catalogo" className="home-cta-button">
            Ver catálogo completo
          </Link>
        </div>
      </section>

    </>
  )
}
