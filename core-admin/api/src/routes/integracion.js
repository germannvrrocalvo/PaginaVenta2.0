const express = require('express')
const { createChecker } = require('../lib/validate')
const { ValidationError } = require('../lib/errors')

// Endpoints que llama n8n. Cada llamada (correcta, duplicada o fallida)
// queda registrada en registro_integracion con su payload.
function createIntegracionRouter({ pedidos, incidencias, registro }) {
  const router = express.Router()

  // Datos de trazabilidad que n8n puede mandar en cabeceras
  const contexto = (req) => ({
    event_id: typeof req.body?.event_id === 'string' ? req.body.event_id : null,
    origen: req.get('x-origen') === 'agente' ? 'agente' : 'n8n',
    workflow: req.get('x-workflow') || null,
    ejecucion_id: req.get('x-execution-id') || null,
  })

  // Envuelve cada endpoint: ejecuta, registra el resultado en el log y responde
  const handle = ({ tipo, entidad, ref }, fn) => async (req, res) => {
    const tipoEvento = typeof tipo === 'function' ? tipo(req) : tipo
    const base = { ...contexto(req), tipo_evento: tipoEvento, entidad, payload: req.body ?? null }
    try {
      const r = await fn(req)
      const logId = await registro.log({
        ...base,
        resultado: r.resultado,
        codigo_http: r.status,
        mensaje: r.mensaje,
        tipo_error: r.tipo_error || null,
        entidad_ref: r.entidad_ref,
      })
      res.status(r.status).json({ ...r.body, log_id: logId })
    } catch (error) {
      const status = error.status || 500
      const detalle = error.details?.map((d) => `${d.campo}: ${d.error}`).join('; ')
      const logId = await registro.log({
        ...base,
        resultado: 'error',
        codigo_http: status,
        tipo_error: error.code || (status >= 500 ? 'interno' : 'peticion'),
        mensaje: detalle ? `${error.message} ${detalle}` : error.message,
        entidad_ref: ref ? ref(req) : null,
      })
      if (status >= 500) console.error(error)
      res.status(status).json({
        ok: false,
        resultado: 'error',
        error: status >= 500 ? 'Error interno del back-office.' : error.message,
        errores: error.details,
        log_id: logId,
      })
    }
  }

  // Escenario 1: pedido creado en la tienda
  router.post('/pedidos', handle(
    { tipo: 'order.created', entidad: 'pedido', ref: (req) => req.body?.order?.id },
    (req) => pedidos.ingestOrderCreated(req.body),
  ))

  // Escenario 2: cambio de estado de un pedido
  router.post('/pedidos/estado', handle(
    { tipo: 'order.status_changed', entidad: 'pedido', ref: (req) => req.body?.order?.id },
    (req) => pedidos.ingestStatusChanged(req.body),
  ))

  router.post('/incidencias', handle(
    { tipo: 'support.requested', entidad: 'incidencia', ref: (req) => req.body?.incident?.reference },
    (req) => incidencias.ingestCreated(req.body),
  ))

  router.post('/incidencias/:referencia/interacciones', handle(
    {
      tipo: 'support.interaction',
      entidad: 'incidencia',
      ref: (req) => req.params.referencia,
    },
    (req) => incidencias.createInteraction(req.params.referencia, req.body ?? {}),
  ))

  router.post('/incidencias/:referencia/estado', handle(
    {
      tipo: 'support.status_changed',
      entidad: 'incidencia',
      ref: (req) => req.params.referencia,
    },
    (req) => incidencias.updateIncident(req.params.referencia, req.body ?? {}),
  ))

  // n8n registra el resultado de sus propias ejecuciones (p. ej. su rama de error)
  router.post('/logs', async (req, res) => {
    const p = req.body ?? {}
    const c = createChecker(p)
    c.string('tipo_evento', { max: 60 })
    c.oneOf('resultado', ['correcto', 'error', 'duplicado', 'advertencia', 'pendiente'])
    c.string('mensaje', { max: 500 })
    if (c.errors.length) throw new ValidationError(c.errors)
    const id = await registro.log({
      event_id: p.event_id || null,
      tipo_evento: p.tipo_evento,
      origen: 'n8n',
      resultado: p.resultado,
      mensaje: p.mensaje,
      tipo_error: p.tipo_error || null,
      entidad: p.entidad || null,
      entidad_ref: p.entidad_ref || null,
      workflow: p.workflow || req.get('x-workflow') || null,
      ejecucion_id: p.ejecucion_id || req.get('x-execution-id') || null,
      payload: p.payload ?? null,
    })
    res.status(201).json({ ok: true, log_id: id })
  })

  return router
}

module.exports = { createIntegracionRouter }