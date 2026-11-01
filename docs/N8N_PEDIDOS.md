# Automatización `order.created` hacia n8n

El backend registra el pedido y su evento de integración en la misma transacción PostgreSQL. La petición HTTP a n8n se realiza después del `COMMIT`, con un tiempo máximo de espera y fuera de la respuesta de compra. Si n8n no está disponible, la compra sigue confirmada y el evento queda en `integration_outbox` para reintento.

## Contrato JSON

```json
{
  "event_id": "order.created:UC-2026-01004",
  "event_type": "order.created",
  "timestamp": "2026-11-01T10:00:00.000Z",
  "order": {
    "id": "UC-2026-01004",
    "customer_id": "42",
    "customer_email": "cliente@example.com",
    "items": [
      {
        "product_id": "PROD-002",
        "name": "Auriculares de prueba",
        "quantity": 1,
        "unit_price": 79.99
      }
    ],
    "total": 79.99,
    "currency": "EUR",
    "status": "pending",
    "created_at": "2026-11-01T10:00:00.000Z"
  }
}
```

`event_id` es determinista y también se envía en la cabecera `Idempotency-Key`. n8n debe usar `event_id` u `order.id` para conservar su protección frente a duplicados.

## Configuración exacta en n8n

1. Abre el nodo Webhook del flujo **SIE - Integración de pedidos**.
2. Configura `POST` y selecciona la respuesta mediante el nodo **Respond to Webhook** que ya utiliza el flujo.
3. En **Authentication**, selecciona **Header Auth** y crea una credencial:
   - **Name:** `Authorization`
   - **Value:** `Bearer <SECRETO_GENERADO_POR_EL_GRUPO>`
4. No pegues ese secreto en el workflow, en capturas, en GitHub ni en la memoria. Guárdalo solo en la credencial de n8n y en las variables privadas de Render.
5. Mantén la validación existente de `event_id`, `event_type`, `timestamp`, `order.id`, `order.customer_id`, `order.customer_email`, `order.items`, `order.total`, `order.currency`, `order.status` y `order.created_at`.
6. Activa el workflow y copia la **Production URL** del Webhook. No uses la Test URL en Render.

El backend añade `Bearer ` automáticamente. En Render se guarda únicamente el valor del secreto, sin ese prefijo.

## Configuración exacta en Render

En **ucam-stereo-api > Environment**, crea estas variables privadas:

| Variable | Valor |
| --- | --- |
| `N8N_ORDER_WEBHOOK_URL` | Production URL copiada del nodo Webhook de n8n |
| `N8N_ORDER_WEBHOOK_SECRET` | El mismo secreto usado en la credencial Header Auth, sin `Bearer ` |
| `N8N_ORDER_WEBHOOK_TIMEOUT_MS` | `5000` |
| `N8N_ORDER_WEBHOOK_POLL_INTERVAL_MS` | `10000` |
| `N8N_ORDER_WEBHOOK_MAX_ATTEMPTS` | `8` |

No reutilices ni sustituyas `N8N_WEBHOOK_URL`: esa variable pertenece al flujo de recibo posterior al pago que ya tenía el proyecto.

Guarda los cambios y despliega el commit. El comando de arranque de Render ejecuta automáticamente la migración idempotente `009_order_created_outbox.sql`; no borra pedidos ni vuelve a cargar el catálogo.

## Comprobaciones

1. Activa el workflow de n8n.
2. Realiza una compra de prueba desde el frontend.
3. Comprueba en el historial de n8n que el evento es `order.created` y que el identificador coincide con el pedido creado.
4. Comprueba en el back-office Neon que aparecen el pedido y sus líneas.
5. En PostgreSQL de la tienda, revisa la entrega sin mostrar el payload ni datos personales:

```sql
SELECT event_id, status, attempts, last_http_status, last_error,
       created_at, delivered_at
FROM integration_outbox
ORDER BY id DESC
LIMIT 20;
```

El resultado normal es `status = 'delivered'` y `last_http_status = 200`. Una respuesta `already_processed` del workflow también debe ser HTTP 200 y se considera entregada.

## Prueba de fallo y reintento

1. Desactiva temporalmente el workflow de n8n o configura en un entorno de prueba una URL que responda con error.
2. Crea otro pedido. La API debe seguir devolviendo `201` porque el fallo externo no revierte la compra.
3. Verifica que el evento queda como `retry`, con `attempts > 0` y `last_error` informado.
4. Restaura el workflow. El worker reintentará automáticamente hasta dejarlo como `delivered`.

Tras ocho fallos, el evento pasa a `dead_letter` para evitar un bucle infinito. Después de corregir la causa se puede reactivar un evento concreto:

```sql
UPDATE integration_outbox
SET status = 'retry', attempts = 0, next_attempt_at = now(),
    locked_at = NULL, last_error = NULL, updated_at = now()
WHERE event_id = 'order.created:UC-2026-XXXXX'
  AND status = 'dead_letter';
```

Sustituye `UC-2026-XXXXX` por un pedido de prueba real. No ejecutes actualizaciones masivas sobre la tabla.

## Tests locales

Desde `backend`:

```text
# Configura antes TRACKING_LINK_SECRET en backend/.env con un valor local.
npm ci
npm test
```

Las pruebas verifican el contrato JSON, la autenticación, la clave de idempotencia, el registro de éxito, los reintentos y el paso a revisión manual.
