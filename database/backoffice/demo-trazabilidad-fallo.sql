-- =====================================================================
-- UCAM Stereo - Caso demostrable de trazabilidad de un fallo
--
-- Inserta un evento de prueba controlado en integration_logs. No crea ni
-- modifica pedidos, incidencias ni eventos de la outbox.
-- Es idempotente: ejecutar varias veces no duplica el registro.
-- Ejecutar en la base de datos PostgreSQL DEL BACK-OFFICE.
-- =====================================================================

INSERT INTO public.integration_logs (
    event_id,
    event_type,
    order_id,
    workflow_name,
    execution_id,
    integration_status,
    error_type,
    error_message,
    created_at
)
SELECT
    'demo.traceability.failed.connection',
    'traceability.demo_failure',
    NULL,
    'Prueba controlada de trazabilidad',
    'manual-demo-trazabilidad-fallo',
    'failed',
    'simulated_connection_error',
    'Fallo de prueba: se simula que el servicio de destino no responde. Registro creado para verificar la trazabilidad y el KPI de éxito de integración.',
    now()
WHERE NOT EXISTS (
    SELECT 1
    FROM public.integration_logs
    WHERE event_id = 'demo.traceability.failed.connection'
      AND integration_status = 'failed'
);

-- Comprobación: debe aparecer una fila con integration_status = failed.
SELECT
    event_id,
    event_type,
    workflow_name,
    execution_id,
    integration_status,
    error_type,
    error_message,
    created_at
FROM public.integration_logs
WHERE event_id = 'demo.traceability.failed.connection'
ORDER BY created_at DESC;

-- Comprobación del KPI: el porcentaje debe bajar al incluir este fallo.
-- La vista dashboard.kpis se actualiza automáticamente al consultarla.
SELECT
    eventos_totales,
    eventos_correctos,
    eventos_duplicados,
    eventos_fallidos,
    tasa_exito_integracion_pct
FROM dashboard.kpis;

-- Limpieza opcional, solo si se desea retirar el evento demostrativo:
-- DELETE FROM public.integration_logs
-- WHERE event_id = 'demo.traceability.failed.connection';
