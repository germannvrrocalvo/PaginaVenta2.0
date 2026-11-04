# Payloads de prueba (Tarea 2)

Tres eventos de ejemplo, uno por escenario. Tienen **exactamente el formato que genera el backend**
(`backend/src/services/order-event-outbox.js`) y pasan la validación de los workflows de n8n.
Todos los datos son **ficticios** (cliente demo `cliente@ucam.test`, pedido `UC-2026-09001`).

| Archivo | Escenario | Evento | Webhook de n8n |
|---|---|---|---|
| `01-order-created.json` | 1 · Pedido integrado | `order.created` | `SIE - Integración de pedidos` |
| `02-order-status-changed.json` | 2 · Cambio de estado | `order.status_changed` | `SIE - Cambio automático de estado de pedido` (`/webhook/sie-order-status-changed`) |
| `03-support-requested.json` | 3 · Incidencia + Telegram | `support.requested` | `SIE - Incidencia y Telegram` (`/webhook/sie-support-requested`) |

Los tres cuentan una misma historia: el cliente compra un tocadiscos Sony PS-LX310BT y unos
auriculares Sennheiser HD 599 (378 €), paga con PayPal (`creado` → `pagado`) y abre una incidencia
porque los auriculares tienen ruido.

## Cómo enviarlos

Enviarlos **en orden** (1, 2, 3): el cambio de estado necesita que el pedido ya exista en el back-office.

- Método `POST`, cuerpo = el JSON, `Content-Type: application/json`.
- Cabecera `Authorization: Bearer <secreto>` (el mismo de la credencial *Header Auth* de n8n; **no se sube al repositorio**).
- Cabecera `Idempotency-Key: <event_id del JSON>`.

En `03-support-requested.json`, cambiar `REEMPLAZAR_CON_TELEGRAM_TEST_CHAT_ID` por el chat de prueba del grupo.
Si se deja así, la incidencia se crea igualmente, pero el aviso de Telegram falla y queda registrado en
`integration_logs` como `failed` / `telegram_error` (sirve también como prueba de trazabilidad).

## Resultado esperado

| Payload | Respuesta de n8n | En la BD del back-office |
|---|---|---|
| 1 | 200 | Fila en `orders` y 2 en `order_items`; log `completed` en `integration_logs` |
| 2 | 200 | `orders.order_status = 'pagado'`; log `completed` |
| 3 | 200 | Fila en `incidents`; log `completed` y mensaje en Telegram |

Reenviar el mismo payload no duplica nada: el log queda como `already_processed` (idempotencia).
Para probar la rama de error, borrar un campo obligatorio (por ejemplo `order.id`): n8n responde **400** con
`missing_fields`.
