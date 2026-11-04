# Escenarios 15 y 16 - configuración y prueba

## Estado actual

- **15 - Cambio de estado:** backend y workflow de n8n terminados. El workflow `SIE - Cambio automático de estado de pedido` está publicado.
- **16 - Incidencia y Telegram:** backend y workflow terminados. El workflow `SIE - Incidencia y Telegram` está importado en n8n, pero queda sin publicar hasta conectar una credencial de Telegram.
- También se ha preparado `SIE - Telegram tras aprobación humana` para completar la revisión humana del punto 18 con el mismo bot.

Los eventos se guardan primero en `integration_outbox`. Si n8n o Telegram no responden, el backend reintenta y la compra o la creación de la incidencia no se deshacen.

## Variables de Render

En el servicio del backend, añadir o actualizar estas variables:

```text
N8N_ORDER_STATUS_WEBHOOK_URL=https://tarea2.app.n8n.cloud/webhook/sie-order-status-changed
N8N_SUPPORT_WEBHOOK_URL=https://tarea2.app.n8n.cloud/webhook/sie-support-requested
TELEGRAM_TEST_CHAT_ID=<id del chat académico de prueba>
```

Se reutilizan `N8N_ORDER_WEBHOOK_SECRET` y la credencial `Header Auth account` ya configurada. No se debe copiar el secreto a documentación ni al repositorio.

Para el flujo adicional de aprobación humana:

```text
N8N_INCIDENT_ACTION_WEBHOOK_URL=https://tarea2.app.n8n.cloud/webhook/sie-agent-action-approved
```

`N8N_INCIDENT_ACTION_WEBHOOK_HEADER` y `N8N_INCIDENT_ACTION_WEBHOOK_SECRET` pueden omitirse si deben reutilizar los valores de `N8N_INCIDENT_AGENT_WEBHOOK_HEADER` y `N8N_INCIDENT_AGENT_WEBHOOK_SECRET`.

## Credencial de Telegram en n8n

1. Crear un bot de prueba con `@BotFather` y conservar el token fuera del repositorio.
2. En n8n, abrir `SIE - Incidencia y Telegram`.
3. Abrir el nodo `Telegram - Avisar nueva incidencia`.
4. Pulsar `Connect to Telegram`, crear la credencial y pegar el token del bot.
5. Guardar la credencial y publicar el workflow.
6. Repetir la selección de esa misma credencial en `SIE - Telegram tras aprobación humana` y publicar ese workflow cuando se quiera completar el punto 18.

## Despliegue

Al desplegar el backend con `AUTO_INIT_DB=true` se aplican:

- `database/migrations/013_support_requested.sql` en la base de la tienda.
- `database/backoffice/schema.sql` en la base del back-office.

La inicialización añade las columnas de trazabilidad de Telegram sin borrar tablas ni pedidos existentes.

## Prueba del escenario 15 sin Postman

1. Desplegar el backend actualizado en Render.
2. Realizar una compra real de prueba desde la tienda usando PayPal Sandbox.
3. Completar el pago. El pedido cambia de `creado` a `pagado` y el backend emite `order.status_changed`.
4. En n8n, abrir `Executions` del workflow `SIE - Cambio automático de estado de pedido` y comprobar una ejecución correcta.
5. En Neon, ejecutar:

```sql
SELECT order_id, order_status, integrated_at
FROM public.orders
ORDER BY integrated_at DESC
LIMIT 5;

SELECT event_id, event_type, order_id, integration_status, error_type, created_at
FROM public.integration_logs
WHERE event_type = 'order.status_changed'
ORDER BY created_at DESC
LIMIT 10;
```

El pedido debe aparecer con el nuevo estado. Si el pedido aún no estaba proyectado, n8n responde temporalmente con error y la outbox lo reintenta.

## Prueba del escenario 16 sin Postman

1. Con el bot conectado y el workflow publicado, abrir el formulario de soporte de la tienda.
2. Crear una incidencia con un pedido de prueba.
3. Comprobar que aparece en CoreAdmin y en la tabla `incidents`.
4. Comprobar que el chat académico de Telegram recibe el aviso.
5. En Neon, ejecutar:

```sql
SELECT source_reference, order_id, customer_name, subject, status,
       telegram_message_id, telegram_notified_at, created_at
FROM public.incidents
ORDER BY created_at DESC
LIMIT 10;

SELECT event_id, event_type, order_id, integration_status, error_type, created_at
FROM public.integration_logs
WHERE event_type = 'support.requested'
ORDER BY created_at DESC
LIMIT 10;
```

## Archivos exportables

- `docs/n8n/15-cambio-automatico-estado.json`
- `docs/n8n/16-incidencia-y-telegram.json`
- `docs/n8n/16-telegram-tras-aprobacion.json`

Estos archivos no contienen tokens ni contraseñas.
