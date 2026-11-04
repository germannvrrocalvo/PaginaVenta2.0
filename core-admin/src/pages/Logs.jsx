import { Database, ListChecks, ShieldCheck } from 'lucide-react'
import ChartbrewReport from '../components/ChartbrewReport'

// Registro de eventos de integración (tabla integration_logs del back-office).
// La URL se puede cambiar con VITE_LOGS_EMBED_URL sin tocar el código.
const LOGS_URL =
  import.meta.env.VITE_LOGS_EMBED_URL ||
  'https://app.chartbrew.com/report/Logs_43640?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2ZXJzaW9uIjoyLCJzdWIiOnsidHlwZSI6IlByb2plY3QiLCJpZCI6IjQzNjQwIiwic2hhcmVQb2xpY3lJZCI6MjAyfSwiaWF0IjoxNzkzODMyOTc2LCJleHAiOjEwNDMzNzQ2NTc2fQ.UaGr6LwTVeG1WnON99gIlRNH32Itl70fFEGariFrZBo'

const infoCards = [
  {
    icon: Database,
    title: 'Origen',
    text: 'Tabla integration_logs del back-office: cada evento que procesa n8n (pedidos, cambios de estado e incidencias).',
  },
  {
    icon: ListChecks,
    title: 'Resultado',
    text: 'Correcto (completed), duplicado descartado por idempotencia (already_processed) o fallido, con su tipo y mensaje de error.',
  },
  {
    icon: ShieldCheck,
    title: 'Solo lectura',
    text: 'Se consulta con el usuario dashboard_reader, que solo puede leer las vistas del esquema dashboard.',
  },
]

function Logs() {
  return (
    <ChartbrewReport
      title="Registro de eventos"
      description="Trazabilidad de todas las ejecuciones de integración del back-office."
      url={LOGS_URL}
      infoCards={infoCards}
    />
  )
}

export default Logs
