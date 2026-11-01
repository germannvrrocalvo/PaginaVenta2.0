import { useParams } from 'react-router-dom'

const INFO_PAGES = {
  devoluciones: {
    title: 'Devoluciones',
    intro:
      'Dispones de 30 días naturales desde la recepción del pedido para devolverlo si no estás satisfecho.',
    sections: [
      {
        heading: 'Condiciones',
        body:
          'El producto debe estar en su embalaje original, sin señales de uso y con todos los accesorios incluidos (cápsulas, cables, manuales). Los vinilos solo se aceptan sin desprecintar.',
      },
      {
        heading: 'Cómo devolver un producto',
        body:
          'Escríbenos a devoluciones@ucamstereo.es indicando tu número de pedido. Te enviaremos una etiqueta de devolución prepagada y recogeremos el paquete en la dirección que nos indiques.',
      },
      {
        heading: 'Reembolso',
        body:
          'Una vez recibido y verificado el producto, el reembolso se tramita en un plazo máximo de 14 días, en el mismo método de pago utilizado en la compra.',
      },
    ],
  },

  garantia: {
    title: 'Garantía',
    intro:
      'Todos los productos de UCAM Stereo cuentan con 2 años de garantía legal por defectos de fabricación, conforme a la normativa española de consumo.',
    sections: [
      {
        heading: 'Qué cubre',
        body:
          'Fallos de fabricación en motores, electrónica, conexiones y componentes mecánicos. En vintage restaurados, la garantía cubre el trabajo de restauración realizado por nuestro taller.',
      },
      {
        heading: 'Qué no cubre',
        body:
          'Desgaste normal por uso (agujas, cápsulas tras su vida útil), daños por mal uso, humedad, golpes o manipulación por terceros no autorizados.',
      },
      {
        heading: 'Cómo reclamar la garantía',
        body:
          'Contacta con garantia@ucamstereo.es adjuntando tu número de pedido y una descripción del problema. Te indicaremos si el producto debe enviarse a nuestro taller o si aplica una sustitución directa.',
      },
    ],
  },

  faq: {
    title: 'Preguntas frecuentes',
    intro:
      'Las dudas más habituales sobre nuestros productos y pedidos. Si no encuentras lo que buscas, escríbenos.',
    faqs: [
      {
        q: '¿Los tocadiscos incluyen cápsula?',
        a:
          'Sí, todos nuestros tocadiscos se venden con la cápsula fonográfica ya instalada y calibrada, lista para usar nada más sacarla de la caja.',
      },
      {
        q: '¿Puedo escuchar el equipo antes de comprarlo?',
        a:
          'Claro. Puedes visitar nuestra tienda física en el Campus de los Jerónimos con cita previa y probar cualquier modelo antes de decidirte.',
      },
      {
        q: '¿Qué diferencia hay entre tracción por correa y tracción directa?',
        a:
          'La tracción directa ofrece más par motor y velocidad de arranque, ideal para scratch y DJ, mientras que la tracción por correa aísla mejor el plato de las vibraciones del motor, favoreciendo la fidelidad en escucha doméstica.',
      },
      {
        q: '¿Los productos tienen garantía?',
        a:
          'Sí, 2 años de garantía legal en todos los productos, gestionada directamente con nosotros sin trámites adicionales.',
      },
      {
        q: '¿Puedo pagar a plazos?',
        a:
          'El prototipo permite simular un pago con PayPal. No hay cobros reales ni financiación.',
      },
      {
        q: '¿Hacéis envíos internacionales fuera de Portugal?',
        a:
          'Por ahora solo enviamos dentro de España y Portugal. Estamos trabajando para ampliar la cobertura a otros países de la UE próximamente.',
      },
    ],
  },

  cookies: {
    title: 'Política de cookies',
    intro:
      'Este sitio utiliza cookies propias y de terceros para mejorar tu experiencia de navegación y analizar el uso de la web.',
    sections: [
      {
        heading: 'Cookies técnicas',
        body:
          'Necesarias para el funcionamiento básico de la tienda: mantener tu sesión iniciada, recordar el contenido del carrito y gestionar preferencias de navegación.',
      },
      {
        heading: 'Cookies analíticas',
        body:
          'Nos ayudan a entender cómo se navega por el sitio para mejorar la experiencia de compra.',
      },
    ],
  },

  'aviso-legal': {
    title: 'Aviso legal',
    intro:
      'Información legal sobre la titularidad y condiciones de uso de este sitio web, conforme a la Ley de Servicios de la Sociedad de la Información (LSSI).',
    sections: [
      {
        heading: 'Titular del sitio',
        body:
          'UCAM Stereo · Universidad Católica de Murcia (UCAM), Campus de los Jerónimos, 30107 Guadalupe, Murcia, España.',
      },
      {
        heading: 'Propiedad intelectual',
        body:
          'Los contenidos de este sitio (textos, imágenes, diseño y código) son propiedad de UCAM Stereo o de sus respectivos titulares, y no pueden reproducirse sin autorización expresa.',
      },
      {
        heading: 'Condiciones de uso',
        body:
          'El uso de este sitio web implica la aceptación de este aviso legal. Queda prohibido su uso con fines ilícitos o que puedan dañar los derechos de terceros.',
      },
    ],
  },

  terminos: {
    title: 'Términos y condiciones',
    intro:
      'Al realizar un pedido en UCAM Stereo aceptas las condiciones descritas a continuación.',
    sections: [
      {
        heading: 'Precios y disponibilidad',
        body:
          'Todos los precios incluyen IVA. Nos reservamos el derecho a modificar precios y disponibilidad de stock sin previo aviso, sin afectar a pedidos ya confirmados.',
      },
      {
        heading: 'Proceso de compra',
        body:
          'El contrato de compraventa se entiende formalizado en el momento en que recibes el email de confirmación del pedido, no al añadir productos al carrito.',
      },
      {
        heading: 'Pago',
        body:
          'El pago se simula con PayPal después de revisar el pedido. Este prototipo no se conecta a una pasarela ni realiza cargos.',
      },
      {
        heading: 'Responsabilidad',
        body:
          'UCAM Stereo no se hace responsable de retrasos causados por la empresa de transporte ni de daños derivados de un uso indebido de los productos una vez entregados.',
      },
    ],
  },
}

export default function Info() {
  const { slug } = useParams()
  const page = INFO_PAGES[slug]

  if (!page) {
    return (
      <section className="info-page">
        <div className="info-container">
          <h1>Página no encontrada</h1>
          <p>La información que buscas no existe.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="info-page">
      <div className="info-container">

        <div className="info-header">
          <p className="info-eyebrow">UCAM Stereo</p>

          <h1>{page.title}</h1>

          <p className="info-intro">
            {page.intro}
          </p>
        </div>

        {page.faqs && (
          <div className="info-faqs">
            {page.faqs.map((faq) => (
              <details key={faq.q} className="info-faq">
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        )}

        {page.sections && (
          <div className="info-sections">
            {page.sections.map((section) => (
              <div className="info-section" key={section.heading}>
                <h2>{section.heading}</h2>
                <p>{section.body}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  )
}