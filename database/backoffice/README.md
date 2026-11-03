# Cuadro de mando operativo (back-office)

Cuadro de mando de la Tarea 2 de SIE. Lee datos reales de la base de datos del back-office (`sie-backoffice-db` en Neon), que es donde escriben los flujos de n8n. No hay cifras introducidas a mano: todo se calcula con las vistas de `dashboard.sql`.

**Herramienta:** Looker Studio (Google), conectado a Neon con el conector de PostgreSQL.

**Usuario de conexión:** `dashboard_reader`, que solo puede leer las vistas del esquema `dashboard` y no tiene acceso a las tablas de `public`. La contraseña no está en el repositorio.
**Zona horaria:** `Europe/Madrid`. **Moneda:** EUR.

## Vistas

| Vista | Qué contiene | Uso en el dashboard |
|---|---|---|
| `dashboard.kpis` | Una fila con todos los indicadores | Tarjetas de KPIs |
| `dashboard.pedidos_por_dia` | Pedidos e importe por día, últimos 30 días (días sin pedidos = 0) | Gráfico de evolución (obligatorio) |
| `dashboard.pedidos_por_estado` | Pedidos e importe por `order_status` | Gráfico de barras o circular |
| `dashboard.productos_mas_vendidos` | Unidades, importe y nº de pedidos por producto | Gráfico de barras |
| `dashboard.eventos_por_dia` | Eventos de integración por día y resultado | Barras apiladas |
| `dashboard.errores_por_tipo` | Eventos fallidos agrupados por `error_type` | Tabla |
| `dashboard.incidencias_por_estado` | Incidencias por estado, prioridad y si están abiertas | Tabla o barras |
| `dashboard.agente_por_estado` | Propuestas del agente por `review_status` y confianza media | Barras |
| `dashboard.ultimos_eventos` | Últimos 50 eventos de integración | Tabla de trazabilidad |
| `dashboard.eventos_integracion` | Base: cada log clasificado como correcto / duplicado / fallido | La usan las demás |

## Métricas y cómo se calculan

| Métrica | Cálculo | Tabla origen |
|---|---|---|
| Pedidos totales | `count(*)` | `orders` |
| Importe total | `sum(total_amount)` | `orders` |
| Ticket medio | `avg(total_amount)` | `orders` |
| Tiempo medio de integración | Media de `integrated_at - created_at`, en segundos | `orders` |
| Eventos correctos / duplicados / fallidos | `integration_status`: `completed` = correcto, `already_processed` = duplicado, cualquier otro valor = fallido | `integration_logs` |
| Tasa de éxito de la integración | (eventos - fallidos) / eventos. Los duplicados cuentan como bien gestionados, porque la idempotencia los descarta a propósito | `integration_logs` |
| Errores por tipo | Eventos fallidos agrupados por `error_type` | `integration_logs` |
| Incidencias abiertas / resueltas | `resolved_at IS NULL` / `IS NOT NULL` | `incidents` |
| Tiempo medio de resolución | Media de `resolved_at - created_at`, en horas | `incidents` |
| Propuestas del agente y tasa de aprobación | `review_status IN ('approved','executed','aprobada','ejecutada')` / total | `agent_actions` |
| Productos más vendidos | `sum(quantity)` y `sum(line_total)` por producto | `order_items` |

Si n8n cambia los valores de estado, solo hay que tocar la vista `dashboard.eventos_integracion` (qué es correcto o fallido) y la línea de "aprobadas" de `dashboard.kpis`.

## Justificación de las métricas (borrador: revisar y ampliar para la memoria)

- **Tráfico y errores de la integración** (eventos por día, tasa de éxito, errores por tipo, tiempo de integración): son tres de las cuatro señales doradas de monitorización de sistemas distribuidos (latencia, tráfico, errores, saturación) de Google SRE. *Site Reliability Engineering*, cap. 6.
- **Duplicados como parte del éxito:** la idempotencia en APIs evita procesar dos veces la misma operación al reintentar; un reintento detectado y descartado es un funcionamiento correcto. Stripe: *Idempotent requests*.
- **Incidencias abiertas y tiempo medio de resolución (MTTR):** indicadores clásicos de la gestión de incidencias. Atlassian: *Common incident management metrics*.
- **Pedidos, importe, ticket medio y productos más vendidos:** KPIs básicos de comercio electrónico para medir volumen y valor de las ventas. Shopify: *Average order value*.
- **Propuestas del agente y tasa de aprobación:** miden la supervisión humana de la IA, exigida para sistemas de IA en el Reglamento europeo de IA, art. 14 y recomendada en el NIST AI Risk Management Framework.

## Cómo instalarlo

1. En el SQL Editor de Neon (proyecto `sie-backoffice-db`, base `neondb`), ejecutar `dashboard.sql`.
2. Crear el usuario de solo lectura con una contraseña generada (no subirla al repo):

   ```sql
   CREATE ROLE dashboard_reader WITH LOGIN PASSWORD '<contraseña generada>';
   ```

3. Volver a ejecutar `dashboard.sql` para que se apliquen los permisos al usuario nuevo.
4. Conectar Looker Studio con `dashboard_reader` y una fuente de datos por vista (consulta personalizada `SELECT * FROM dashboard.<vista>`).

Para quitarlo todo:

```sql
DROP SCHEMA dashboard CASCADE;
DROP ROLE dashboard_reader;
```

## Limitaciones conocidas

- Las métricas solo son tan buenas como los datos que escribe n8n: si una incidencia no rellena `resolved_at`, no cuenta como resuelta.
- Con pocos datos de prueba, algunas métricas salen a 0 o vacías.
- Looker Studio guarda en caché los datos (por defecto unos 15 min); se puede forzar la actualización desde el informe.
