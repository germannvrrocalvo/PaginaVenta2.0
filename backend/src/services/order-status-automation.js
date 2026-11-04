const DEFAULT_INTERVAL_MS = 3 * 60 * 60 * 1000
const DEFAULT_POLL_INTERVAL_MS = 60 * 1000
const JOB_NAME = 'ship_one_paid_order'

function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

function createOrderStatusAutomation(pool, orderEventOutbox, {
  enabled = process.env.ORDER_STATUS_AUTOMATION_ENABLED === 'true',
  intervalMs = positiveInteger(
    process.env.ORDER_STATUS_AUTOMATION_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
    { min: 60_000, max: 30 * 24 * 60 * 60 * 1000 }
  ),
  pollIntervalMs = positiveInteger(
    process.env.ORDER_STATUS_AUTOMATION_POLL_INTERVAL_MS,
    DEFAULT_POLL_INTERVAL_MS,
    { min: 10_000, max: 15 * 60 * 1000 }
  ),
  logger = console,
} = {}) {
  let timer = null
  let running = false

  async function runOnce() {
    if (!enabled) return { status: 'disabled' }
    if (running) return { status: 'already_running' }

    running = true
    let client = null
    try {
      client = await pool.connect()
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO automation_job_state (job_name, next_run_at)
         VALUES ($1, now() + ($2 * interval '1 millisecond'))
         ON CONFLICT (job_name) DO NOTHING`,
        [JOB_NAME, intervalMs]
      )

      const { rows: stateRows } = await client.query(
        `SELECT next_run_at, next_run_at <= now() AS due
         FROM automation_job_state
         WHERE job_name = $1
         FOR UPDATE`,
        [JOB_NAME]
      )
      const state = stateRows[0]
      if (!state?.due) {
        await client.query('COMMIT')
        return { status: 'not_due', nextRunAt: state?.next_run_at || null }
      }

      const { rows: candidates } = await client.query(
        `SELECT p.id_pedido, p.numero_pedido, p.estado
         FROM pedido p
         WHERE p.estado = 'pagado'
           AND EXISTS (
             SELECT 1
             FROM pago pg
             WHERE pg.id_pedido = p.id_pedido
               AND pg.resultado = 'approved'
           )
         ORDER BY random()
         FOR UPDATE OF p SKIP LOCKED
         LIMIT 1`
      )
      const order = candidates[0]

      if (!order) {
        const { rows } = await client.query(
          `UPDATE automation_job_state
           SET last_attempt_at = now(),
               next_run_at = now() + ($2 * interval '1 millisecond'),
               updated_at = now()
           WHERE job_name = $1
           RETURNING next_run_at`,
          [JOB_NAME, intervalMs]
        )
        await client.query('COMMIT')
        logger.info('Automatización de envíos: no hay pedidos pagados pendientes de envío.')
        return { status: 'no_eligible_order', nextRunAt: rows[0]?.next_run_at || null }
      }

      const { rows: updatedRows } = await client.query(
        `UPDATE pedido
         SET estado = 'enviado', fecha_actualizacion = now()
         WHERE id_pedido = $1 AND estado = 'pagado'
         RETURNING fecha_actualizacion`,
        [order.id_pedido]
      )
      const changedAt = updatedRows[0].fecha_actualizacion

      await orderEventOutbox.enqueueStatusChanged(client, {
        id: order.numero_pedido,
        fromStatus: 'pagado',
        toStatus: 'enviado',
        changedAt,
        source: 'automatic_shipping_bot',
      })

      const { rows: jobRows } = await client.query(
        `UPDATE automation_job_state
         SET last_attempt_at = now(), last_run_at = now(),
             next_run_at = now() + ($2 * interval '1 millisecond'),
             updated_at = now()
         WHERE job_name = $1
         RETURNING next_run_at`,
        [JOB_NAME, intervalMs]
      )
      await client.query('COMMIT')
      orderEventOutbox.kick()
      logger.info(`Automatización de envíos: ${order.numero_pedido} pasó de pagado a enviado.`)
      return {
        status: 'updated',
        orderId: order.numero_pedido,
        fromStatus: 'pagado',
        toStatus: 'enviado',
        nextRunAt: jobRows[0]?.next_run_at || null,
      }
    } catch (error) {
      if (client) {
        try { await client.query('ROLLBACK') } catch (rollbackError) {
          logger.error('No se pudo revertir la automatización de envíos:', rollbackError)
        }
      }
      throw error
    } finally {
      client?.release()
      running = false
    }
  }

  function start() {
    if (timer) return
    if (!enabled) {
      logger.info('Automatización de envíos desactivada.')
      return
    }
    logger.info(`Automatización de envíos activa: un pedido cada ${intervalMs} ms.`)
    runOnce().catch((error) => logger.error('Falló la automatización de envíos:', error))
    timer = setInterval(() => {
      runOnce().catch((error) => logger.error('Falló la automatización de envíos:', error))
    }, pollIntervalMs)
    timer.unref?.()
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  return { runOnce, start, stop, enabled, intervalMs, pollIntervalMs }
}

module.exports = {
  createOrderStatusAutomation,
  DEFAULT_INTERVAL_MS,
  DEFAULT_POLL_INTERVAL_MS,
  JOB_NAME,
}
