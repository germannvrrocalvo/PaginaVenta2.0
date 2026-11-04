# Prueba de trazabilidad: caso fallido

## Objetivo

Demostrar que un fallo de integración queda persistido en la base de datos del back-office y que se refleja tanto en el registro de eventos como en el indicador **Éxito integración** del dashboard.

## Preparación

1. Acceder a la base de datos PostgreSQL del back-office (no a la base de datos de la tienda).
2. Comprobar que se ha ejecutado `database/backoffice/schema.sql` y que las vistas de `database/backoffice/dashboard.sql` están creadas.
3. Ejecutar el contenido de `database/backoffice/demo-trazabilidad-fallo.sql`.

El script inserta un único evento de demostración con estado `failed`. Es idempotente: si se ejecuta varias veces, no crea copias adicionales. No modifica pedidos, incidencias ni la outbox.

## Resultado esperado

En `public.integration_logs` debe aparecer un registro con estos valores:

| Campo | Valor esperado |
|---|---|
| `event_id` | `demo.traceability.failed.connection` |
| `event_type` | `traceability.demo_failure` |
| `workflow_name` | `Prueba controlada de trazabilidad` |
| `integration_status` | `failed` |
| `error_type` | `simulated_connection_error` |

La vista `dashboard.eventos_integracion` debe clasificarlo como `fallido`. La vista `dashboard.ultimos_eventos` debe mostrarlo entre los eventos recientes y `dashboard.errores_por_tipo` debe contabilizar el error.

En `dashboard.kpis`, `eventos_fallidos` debe aumentar en uno y `tasa_exito_integracion_pct` debe recalcularse incluyendo este fallo. El dashboard de Chartbrew mostrará el nuevo porcentaje cuando actualice sus datos.

## Consultas de verificación

```sql
-- Registro persistido
SELECT event_id, event_type, integration_status, error_type,
       error_message, created_at
FROM public.integration_logs
WHERE event_id = 'demo.traceability.failed.connection';

-- Clasificación del evento
SELECT event_id, resultado, tipo_error, error_message
FROM dashboard.eventos_integracion
WHERE event_id = 'demo.traceability.failed.connection';

-- KPI de integración
SELECT eventos_totales, eventos_correctos, eventos_duplicados,
       eventos_fallidos, tasa_exito_integracion_pct
FROM dashboard.kpis;

-- Historial de errores
SELECT *
FROM dashboard.errores_por_tipo
WHERE tipo_error = 'simulated_connection_error';
```

## Consideración para la demostración

Este registro es un **fallo simulado y etiquetado como prueba**, creado para demostrar la persistencia y visualización de errores. No representa un fallo real de una compra ni una ejecución fallida de n8n. En la defensa se debe explicar esta distinción. Los fallos reales de los workflows también deben registrarse en `integration_logs` con su `execution_id`, tipo y mensaje de error.

## Limpieza opcional

Si se quiere retirar el evento de demostración después de tomar las evidencias:

```sql
DELETE FROM public.integration_logs
WHERE event_id = 'demo.traceability.failed.connection';
```
