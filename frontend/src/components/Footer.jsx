import { Link } from 'react-router-dom'
import { Disc3 } from 'lucide-react'
import { CATEGORIES } from '../data/products.js'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">

        {/* LOGO Y DESCRIPCIÓN */}
        <div>
          <div className="logo">
            <span className="logo-mark">
              <Disc3 size={20} />
            </span>

            <span className="logo-text">
              UCAM <em>Stereo</em>
            </span>
          </div>

          <p className="footer-text">
            El sonido de otra época.
          </p>
        </div>


        {/* TIENDA */}
        <div>
          <h4>Tienda</h4>

          <ul>
            <li>
              <Link to="/catalogo">Catálogo completo</Link>
            </li>

            {CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link to={`/catalogo/${c.slug}`}>
                  {c.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </div>


        {/* AYUDA */}
        <div>
          <h4>Ayuda</h4>

          <ul>
            <li>
              <Link to="/soporte">
                Contacto y soporte
              </Link>
            </li>

            <li>
              <Link to="/info/devoluciones">
                Devoluciones
              </Link>
            </li>

            <li>
              <Link to="/info/faq">
                Preguntas frecuentes
              </Link>
            </li>

            <li>
              <Link to="/info/garantia">
                Garantía
              </Link>
            </li>



            <li>
              <Link to="/admin">
                Back-office
              </Link>
            </li>
          </ul>
        </div>


        {/* INFORMACIÓN */}
        <div>
          <h4>Información</h4>

          <ul>
            <li>
              <Link to="/info/terminos">
                Términos y condiciones
              </Link>
            </li>

            <li>
              <Link to="/info/aviso-legal">
                Aviso legal
              </Link>
            </li>

            <li>
              <Link to="/info/cookies">
                Cookies
              </Link>
            </li>
          </ul>
        </div>

      </div>


      {/* PARTE INFERIOR */}
      <div className="footer-bottom">
        <div className="container">
          © 2026 UCAM Stereo · Prototipo académico sin actividad
          comercial · No introduzcas datos personales reales
        </div>
      </div>
    </footer>
  )
}
