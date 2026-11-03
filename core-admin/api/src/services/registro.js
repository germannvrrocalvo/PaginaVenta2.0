// Log técnico (registro_integracion). Nunca lanza error: si falla el registro,
// la operación principal sigue adelante.

const RESULTADOS = ['correcto', 'error', 'duplicado', 'advertencia', 'pendiente']
const ORIGENES = ['n8n', 'tienda', 'backoffice', 'agente']

function truncate(value, max) {
  if (value == null) return null
  const text = String(value)
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function createRegistroService(pool) {
  async function log(entry) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO registro_integracion
           (event_id, tipo_evento, origen, resultado, codigo_http, mensaje, tipo_error,
            entidad, entidad_ref, workflow, ejecucion_id, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          truncate(entry.event_id, 160),
          truncate(entry.tipo_evento || 'desconocido', 60),
          ORIGENES.includes(entry.origen) ? entry.origen : 'n8n',
          RESULTADOS.includes(entry.resultado) ? entry.resultado : 'advertencia',
          entry.codigo_http ?? null,
          truncate(entry.mensaje, 500),
          truncate(entry.tipo_error, 40),
          truncate(entry.entidad, 20),
          truncate(entry.entidad_ref, 60),
          truncate(entry.workflow, 120),
          truncate(entry.ejecucion_id, 120),
          entry.payload === undefined ? null : JSON.stringify(entry.payload),
        ],
      )
      return rows[0].id
    } catch (error) {
      console.error('No se pudo escribir en registro_integracion:', error.message)
      return null
    }
  }

  return { log }
}

module.exports = { createRegistroService, RESULTADOS, ORIGENES }