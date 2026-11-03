# Publicar UCAM Stereo

La aplicación se publica en tres piezas:

- **DonDominio:** frontend estático.
- **Render Web Service:** backend Node.js.
- **Render Postgres:** base de datos.

## 1. Subir el proyecto a un repositorio privado

Render necesita leer el proyecto desde GitHub, GitLab o Bitbucket. Antes de subirlo, comprueba que `backend/.env` y los archivos `.env` del frontend no aparecen en el repositorio. Las contraseñas se configuran después en Render.

## 2. Crear backend y PostgreSQL en Render

1. En Render, elige **New > Blueprint**.
2. Conecta el repositorio del proyecto.
3. Render detectará `render.yaml` y propondrá `ucam-stereo-api` y `ucam-stereo-db`.
4. Completa las variables que Render solicite:
   - `FRONTEND_URL`: dirección pública final, por ejemplo `https://tudominio.es`.
   - `FRONTEND_ORIGIN`: orígenes permitidos separados por comas. Incluye la tienda y la URL pública de `core-admin`, ambas sin barra final.
   - `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`: credenciales Sandbox de PayPal para las pruebas.
   - `N8N_WEBHOOK_URL` y `N8N_WEBHOOK_SECRET`: dirección pública y secreto del webhook de recibos de pago. Se pueden dejar vacías hasta publicar n8n.
   - `N8N_ORDER_WEBHOOK_URL` y `N8N_ORDER_WEBHOOK_SECRET`: Production URL y secreto privado del webhook `order.created`. La configuración detallada está en `docs/N8N_PEDIDOS.md`.
   - `N8N_INCIDENT_AGENT_WEBHOOK_URL`: Production URL del webhook `agente-incidencias`.
   - `N8N_INCIDENT_AGENT_WEBHOOK_HEADER`: nombre exacto de la cabecera de la credencial Header Auth de n8n.
   - `N8N_INCIDENT_AGENT_WEBHOOK_SECRET`: valor secreto de esa credencial. Nunca se añade al repositorio.
5. Crea el Blueprint y espera a que `/health` responda con `{ "estado": "ok" }`.

La primera ejecución crea las tablas y carga el catálogo si la base está vacía. Los reinicios siguientes no vuelven a cargar ni borran datos.

## 3. Preparar el frontend

1. Copia `frontend/.env.production.example` como `frontend/.env.production`.
2. Sustituye su valor por la dirección real del backend, por ejemplo:

   `VITE_API_URL=https://ucam-stereo-api.onrender.com/api`

3. Dentro de `frontend`, ejecuta `npm ci` y después `npm run build`.
4. El contenido que debe publicarse está en `frontend/dist`.

## 4. Subir el frontend a DonDominio

Con un cliente FTP como FileZilla, conecta con los datos de DonDominio y abre la carpeta remota `public`. Sube **el contenido** de `frontend/dist`, incluido `index.html`, los recursos y `.htaccess`. No subas la carpeta `dist` como una carpeta adicional.

## 4.1. Publicar el back office

1. Copia `core-admin/.env.production.example` como `core-admin/.env.production`.
2. Usa como `VITE_API_URL` la URL del backend sin `/api`, por ejemplo `https://ucam-stereo-api.onrender.com`.
3. Ejecuta `npm ci` y `npm run build` dentro de `core-admin`.
4. Publica el contenido de `core-admin/dist` en su alojamiento estático.
5. Añade el origen público del back office a `FRONTEND_ORIGIN` en Render y despliega de nuevo el backend.

## 5. n8n y los correos

El backend de Render no puede llamar a `localhost`, porque esa dirección señalaría al propio servidor de Render. El webhook de n8n debe tener una URL pública HTTPS. Para una demostración temporal se puede exponer el n8n local mediante un túnel y mantener el ordenador encendido. Para una publicación permanente, n8n debe alojarse en un servidor público y conviene enviar el correo mediante Gmail OAuth o una API HTTPS.

## Límites del plan gratuito

El servicio web gratuito se suspende tras un periodo sin tráfico y el primer acceso puede tardar. La base PostgreSQL gratuita de Render caduca a los 30 días y no incluye copias de seguridad; para conservar pedidos de forma permanente hace falta un plan de pago o una base externa persistente.
