import { Workflow, Repeat, AlertTriangle } from 'lucide-react'
import ChartbrewReport from '../components/ChartbrewReport'

// Estado de las integraciones (workflows de n8n), calculado con integration_logs.
// La URL se puede cambiar con VITE_INTEGRATIONS_EMBED_URL sin tocar el código.
const INTEGRATIONS_URL =
  import.meta.env.VITE_INTEGRATIONS_EMBED_URL ||
  'https://app.chartbrew.com/report/Integraciones_43641?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2ZXJzaW9uIjoyLCJzdWIiOnsidHlwZSI6IlByb2plY3QiLCJpZCI6IjQzNjQxIiwic2hhcmVQb2xpY3lJZCI6MjAzfSwiaWF0IjoxNzkzODMzOTM0LCJleHAiOjEwNDMzNzQ3NTM0fQ.riVkANOo0ecX3OuBsV51DWweSfwpgVWN9fX-DpltzB0'

const infoCards = [
  {
    icon: Workflow,
    title: 'Workflows de n8n',
    text: 'Integración de pedidos, cambio automático de estado e incidencias con Telegram. Cada uno registra sus ejecuciones.',
  },
  {
    icon: Repeat,
    title: 'Reintentos e idempotencia',
    text: 'El backend reintenta desde la outbox si n8n no responde; los eventos repetidos se descartan y cuentan como duplicados.',
  },
  {
    icon: AlertTriangle,
    title: 'Errores',
    text: 'Los eventos fallidos bajan el porcentaje de éxito y aparecen con su tipo de error en la página Logs.',
  },
]

function Integrations() {
  return (
    <ChartbrewReport
      title="Estado de las integraciones"
      description="Actividad y resultado de cada integración entre la tienda, n8n y el back-office."
      url={INTEGRATIONS_URL}
      infoCards={infoCards}
    />
  )
}

export default Integrations
