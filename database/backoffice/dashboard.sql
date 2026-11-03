-- =====================================================================
-- UCAM Stereo · Cuadro de mando operativo (Tarea 2 SIE)
-- Vistas de solo lectura sobre la BD del back-office (Neon: sie-backoffice-db).
-- Crea un esquema aparte "dashboard". NO modifica ni borra las tablas de public.
-- Idempotente: se puede ejecutar varias veces.
-- Para deshacerlo todo: DROP SCHEMA dashboard CASCADE;
-- Zona horaria de las fechas: Europe/Madrid.
--
-- Cómo se clasifican los datos (por si cambian los valores de n8n):
-- integration_logs.integration_status
--   'completed'         -> correcto
--   'already_processed' -> duplicado (bien gestionado por la idempotencia)
--   cualquier otro valor -> fallido
-- Incidencia abierta = resolved_at IS NULL (no depende del texto de status).
-- Propuestas del agente: se agrupan por el valor de review_status.
-- Aprobadas = review_status IN ('approved','executed','aprobada','ejecutada').
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS dashboard;

-- Base: eventos de integración clasificados (único sitio donde se decide
-- qué es correcto / duplicado / fallido)
CREATE OR REPLACE VIEW dashboard.eventos_integracion AS
SELECT
    l.id,
    l.event_id,
    l.event_type,
    l.order_id,
    l.workflow_name,
    l.execution_id,
    l.integration_status,
    CASE
        WHEN l.integration_status = 'completed' THEN 'correcto'
        WHEN l.integration_status = 'already_processed' THEN 'duplicado'
        ELSE 'fallido'
    END AS resultado,
    COALESCE(NULLIF(l.error_type, ''), 'sin tipo') AS tipo_error,
    l.error_message,
    l.created_at,
    (l.created_at AT TIME ZONE 'Europe/Madrid')::date AS fecha
FROM public.integration_logs l;

-- 1. KPIs principales (una sola fila) → tarjetas del cuadro de mando
CREATE OR REPLACE VIEW dashboard.kpis AS
WITH p AS (
    SELECT
        count(*) AS pedidos_totales,
        COALESCE(sum(total_amount), 0) AS importe_total,
        round(avg(total_amount), 2) AS ticket_medio,
        round(avg(EXTRACT(EPOCH FROM (integrated_at - created_at)))::numeric, 1)
            AS segundos_medios_integracion
    FROM public.orders
),
e AS (
    SELECT
        count(*) AS eventos_totales,
        count(*) FILTER (WHERE resultado = 'correcto') AS eventos_correctos,
        count(*) FILTER (WHERE resultado = 'duplicado') AS eventos_duplicados,
        count(*) FILTER (WHERE resultado = 'fallido') AS eventos_fallidos
    FROM dashboard.eventos_integracion
),
i AS (
    SELECT
        count(*) AS incidencias_totales,
        count(*) FILTER (WHERE resolved_at IS NULL) AS incidencias_abiertas,
        count(*) FILTER (WHERE resolved_at IS NOT NULL) AS incidencias_resueltas,
        round(
            (avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
                FILTER (WHERE resolved_at IS NOT NULL))::numeric,
            1
        ) AS horas_medias_resolucion
    FROM public.incidents
),
a AS (
    SELECT
        count(*) AS propuestas_agente,
        count(*) FILTER (
            WHERE review_status IN ('approved','executed','aprobada','ejecutada')
        ) AS propuestas_aprobadas,
        count(*) FILTER (WHERE review_status = 'pending_review') AS propuestas_pendientes
    FROM public.agent_actions
)
SELECT
    p.pedidos_totales,
    p.importe_total,
    p.ticket_medio,
    p.segundos_medios_integracion,
    e.eventos_totales,
    e.eventos_correctos,
    e.eventos_duplicados,
    e.eventos_fallidos,
    round(
        100.0 * (e.eventos_totales - e.eventos_fallidos)
            / NULLIF(e.eventos_totales, 0),
        1
    ) AS tasa_exito_integracion_pct,
    i.incidencias_totales,
    i.incidencias_abiertas,
    i.incidencias_resueltas,
    i.horas_medias_resolucion,
    a.propuestas_agente,
    a.propuestas_aprobadas,
    a.propuestas_pendientes,
    round(
        100.0 * a.propuestas_aprobadas / NULLIF(a.propuestas_agente, 0),
        1
    ) AS tasa_aprobacion_agente_pct
FROM p, e, i, a;

-- 2. Pedidos e importe por día, últimos 30 días (días sin pedidos = 0)
-- → gráfico obligatorio (histórico de pedidos)
CREATE OR REPLACE VIEW dashboard.pedidos_por_dia AS
WITH dias AS (
    SELECT generate_series(
        (now() AT TIME ZONE 'Europe/Madrid')::date - 29,
        (now() AT TIME ZONE 'Europe/Madrid')::date,
        interval '1 day'
    )::date AS fecha
)
SELECT
    d.fecha,
    count(o.id) AS pedidos,
    COALESCE(sum(o.total_amount), 0) AS importe
FROM dias d
LEFT JOIN public.orders o
    ON (o.created_at AT TIME ZONE 'Europe/Madrid')::date = d.fecha
GROUP BY d.fecha
ORDER BY d.fecha;

-- 3. Pedidos por estado
CREATE OR REPLACE VIEW dashboard.pedidos_por_estado AS
SELECT
    COALESCE(order_status, 'sin estado') AS estado,
    count(*) AS pedidos,
    COALESCE(sum(total_amount), 0) AS importe
FROM public.orders
GROUP BY 1
ORDER BY pedidos DESC;

-- 4. Productos más vendidos
CREATE OR REPLACE VIEW dashboard.productos_mas_vendidos AS
SELECT
    COALESCE(product_name, product_id) AS producto,
    sum(quantity) AS unidades,
    COALESCE(sum(line_total), 0) AS importe,
    count(DISTINCT order_id) AS pedidos
FROM public.order_items
GROUP BY 1
ORDER BY unidades DESC, importe DESC;

-- 5. Eventos de integración por día y resultado (correcto/duplicado/fallido)
CREATE OR REPLACE VIEW dashboard.eventos_por_dia AS
SELECT
    fecha,
    resultado,
    count(*) AS eventos
FROM dashboard.eventos_integracion
GROUP BY fecha, resultado
ORDER BY fecha, resultado;

-- 6. Errores por tipo (solo eventos fallidos)
CREATE OR REPLACE VIEW dashboard.errores_por_tipo AS
SELECT
    tipo_error,
    count(*) AS errores,
    max(created_at) AS ultimo_error
FROM dashboard.eventos_integracion
WHERE resultado = 'fallido'
GROUP BY tipo_error
ORDER BY errores DESC;

-- 7. Incidencias por estado y prioridad
CREATE OR REPLACE VIEW dashboard.incidencias_por_estado AS
SELECT
    COALESCE(status, 'sin estado') AS estado,
    COALESCE(priority, 'sin prioridad') AS prioridad,
    CASE WHEN resolved_at IS NULL THEN 'abierta' ELSE 'resuelta' END AS situacion,
    count(*) AS incidencias
FROM public.incidents
GROUP BY 1, 2, 3
ORDER BY incidencias DESC;

-- 8. Propuestas del agente IA por estado de revisión
CREATE OR REPLACE VIEW dashboard.agente_por_estado AS
SELECT
    review_status AS estado_revision,
    count(*) AS propuestas,
    round(avg(confidence), 2) AS confianza_media
FROM public.agent_actions
GROUP BY review_status
ORDER BY propuestas DESC;

-- 9. Últimos eventos de integración (tabla de trazabilidad)
CREATE OR REPLACE VIEW dashboard.ultimos_eventos AS
SELECT
    created_at,
    event_type,
    workflow_name,
    execution_id,
    order_id,
    integration_status,
    resultado,
    tipo_error,
    error_message
FROM dashboard.eventos_integracion
ORDER BY created_at DESC
LIMIT 50;

-- Permisos para el usuario de solo lectura del cuadro de mando.
-- El usuario se crea APARTE (ver README, la contraseña nunca va al repo):
-- CREATE ROLE dashboard_reader WITH LOGIN PASSWORD '<contraseña>';
-- Solo puede leer las vistas de "dashboard", no las tablas de public.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_reader') THEN
        GRANT USAGE ON SCHEMA dashboard TO dashboard_reader;
        GRANT SELECT ON ALL TABLES IN SCHEMA dashboard TO dashboard_reader;
    END IF;
END
$$;
