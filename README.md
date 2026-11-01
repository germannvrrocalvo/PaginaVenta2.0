# UCAM Stereo - Tarea 2

Evolución de la tienda de la Tarea 1 para integrar los pedidos con un back-office independiente mediante n8n.

## Arquitectura

`Tienda React -> Backend Node.js/Render -> PostgreSQL outbox -> n8n -> Back-office Neon`

Cuando PostgreSQL confirma un pedido, el backend registra en la misma transacción un evento `order.created`. La entrega a n8n se realiza después del `COMMIT`, con autenticación, timeout, idempotencia y reintentos. Si n8n no está disponible, la compra no se pierde ni queda bloqueada.

## Estructura

- `frontend/`: tienda React y Vite.
- `backend/`: API Node.js/Express y pruebas.
- `database/`: esquema, datos y migraciones PostgreSQL.
- `docs/N8N_PEDIDOS.md`: contrato JSON y configuración exacta de Render y n8n.
- `render.yaml`: Blueprint de despliegue sin valores secretos.

## Desarrollo local

1. Copia `backend/.env.example` como `backend/.env` y completa únicamente valores locales o de prueba.
2. Prepara PostgreSQL con `database/Estructura.sql` y `database/Datos.sql`.
3. Instala dependencias y ejecuta la tienda:

```text
cd frontend
npm ci
npm run dev
```

El entorno de desarrollo inicia el frontend en `http://localhost:5173` y el backend en `http://localhost:3000`.

## Pruebas

Configura `TRACKING_LINK_SECRET` con un valor local de prueba y ejecuta:

```text
cd backend
npm ci
npm test
```

La suite comprueba pedidos, autenticación, PayPal Sandbox, contrato `order.created`, autenticación del webhook, timeout, reintentos e idempotencia.

## Configuración de la integración

Las variables privadas se configuran en Render, nunca en GitHub:

- `N8N_ORDER_WEBHOOK_URL`
- `N8N_ORDER_WEBHOOK_SECRET`
- `N8N_ORDER_WEBHOOK_TIMEOUT_MS` (opcional, valor recomendado: `5000`)
- `N8N_ORDER_WEBHOOK_POLL_INTERVAL_MS` (opcional, valor recomendado: `10000`)
- `N8N_ORDER_WEBHOOK_MAX_ATTEMPTS` (opcional, valor recomendado: `8`)

Consulta `docs/N8N_PEDIDOS.md` antes de desplegar o probar una compra real.

## Seguridad y alcance académico

El repositorio no contiene credenciales reales, archivos `.env` ni datos personales reales. La tienda y sus integraciones son un prototipo académico sin actividad comercial real.
