# UCAM Stereo – Tarea 2

Evolución de UCAM Stereo (Tarea 1) para integrar la tienda online con un **back-office independiente**, utilizando n8n como plataforma de automatización y PostgreSQL como sistema de persistencia.

El objetivo es automatizar el intercambio de información entre la tienda y el back-office, mantener la trazabilidad de las operaciones y facilitar la gestión de pedidos, incidencias e interacciones postventa mediante un panel de administración y un agente de IA supervisado.

**Repositorio:** [PaginaVenta2.0](https://github.com/germannvrrocalvo/PaginaVenta2.0)

---

## 1. Arquitectura del sistema

La arquitectura general del proyecto es:

```text
Tienda React
     |
     v
Backend Node.js / Express
     |
     v
PostgreSQL (Outbox)
     |
     v
n8n (Automatización e integración)
     |
     v
Back-office independiente
     |
     +---- PostgreSQL
     |
     +---- CoreAdmin (Panel de administración)
```

Cuando PostgreSQL confirma un pedido, el backend registra en la misma transacción un evento `order.created`.

La entrega del evento a n8n se realiza después del `COMMIT`, utilizando autenticación, timeout, idempotencia y reintentos. De esta forma, si n8n no está disponible, la compra no se pierde ni queda bloqueada.

El back-office mantiene su propia persistencia, independiente de la base de datos de la tienda. n8n se encarga de recibir, validar, normalizar y transmitir los eventos entre los sistemas.

---

## 2. Estructura del repositorio

```text
PaginaVenta2.0/
│
├── frontend/                 # Tienda online React + Vite
│
├── backend/                  # API Node.js + Express
│   └── tests/                # Pruebas automatizadas
│
├── database/                 # Esquema, datos y migraciones
│   └── backoffice/           # Esquema del back-office y vistas del cuadro de mando
│
├── core-admin/               # Back-office React + Vite
│   └── src/
│       ├── components/       # Componentes reutilizables
│       ├── layouts/          # Estructura general del panel
│       ├── pages/             # Páginas del back-office
│       └── data/              # Datos de desarrollo
│
├── shared/                   # Recursos compartidos
│
├── docs/
│   └── N8N_PEDIDOS.md        # Contrato JSON y configuración
│
├── render.yaml               # Configuración de despliegue
└── README.md
```

### Componentes principales

| Componente | Tecnologías | Responsabilidad |
|---|---|---|
| Tienda online | React, Vite | Catálogo, carrito y compras |
| Backend | Node.js, Express | API, pedidos y eventos |
| Base de datos de la tienda | PostgreSQL | Persistencia de la tienda |
| Automatización | n8n | Recepción y procesamiento de eventos |
| Back-office | PostgreSQL | Persistencia independiente y operaciones |
| Panel de administración | React, Vite | Consulta y gestión mediante CoreAdmin |

---

## 3. CoreAdmin – Back-office

CoreAdmin es el panel de administración desarrollado para gestionar la información operativa del back-office.

Utiliza React, Vite, JavaScript, CSS y React Router DOM.

### Secciones del panel

| Sección | Funcionalidad |
|---|---|
| Dashboard | Cuadro de mando con datos reales del back-office (Chartbrew) |
| Pedidos | Consulta, búsqueda, filtros y actualización de estados |
| Incidencias | Consulta, clasificación y actualización de incidencias |
| Integraciones | Estado y actividad de los servicios conectados |
| Agente IA | Visualización y supervisión de propuestas de acciones |
| Logs | Registro y consulta de operaciones |

Todas las secciones de CoreAdmin (Dashboard, Pedidos, Incidencias, Integraciones, Agente IA y Logs) trabajan con datos reales del back-office.
---

## 4. Requisitos e instalaciones

Para trabajar con el proyecto se necesitan las siguientes herramientas.

### Programas principales

| Herramienta | Uso | Descarga |
|---|---|---|
| Node.js | Ejecutar frontend y backend | [nodejs.org](https://nodejs.org/es/download) |
| Git | Control de versiones | [git-scm.com](https://git-scm.com/downloads) |
| Visual Studio Code | Editor de código | [code.visualstudio.com](https://code.visualstudio.com/) |
| PostgreSQL | Base de datos local, si se necesita | [postgresql.org](https://www.postgresql.org/download/) |
| pgAdmin | Administración visual de PostgreSQL (opcional) | [pgadmin.org](https://www.pgadmin.org/download/) |

**Versión de Node.js:** el backend requiere Node.js `>=22 <25`. Se recomienda utilizar una versión 22.x o 24.x compatible con ese requisito.

### Servicios y plataformas

No necesitan instalarse necesariamente en el ordenador, ya que se pueden utilizar desde el navegador.

| Servicio | Uso | Acceso |
|---|---|---|
| GitHub | Repositorio y colaboración | [github.com](https://github.com/) |
| n8n | Automatizaciones y workflows | [n8n.io](https://n8n.io/) |
| Documentación de n8n | Configuración y desarrollo de workflows | [docs.n8n.io](https://docs.n8n.io/) |
| Neon | PostgreSQL alojado en la nube | [neon.tech](https://neon.tech/) |
| Render | Despliegue del backend y servicios | [render.com](https://render.com/) |

### Comprobar las instalaciones

Después de instalar Node.js y Git, abrir PowerShell o la terminal de VS Code y ejecutar:

```powershell
node -v
npm -v
git --version
```

Si los comandos devuelven sus respectivas versiones, las herramientas están disponibles.

**Nota:** React, Vite, Express y las demás dependencias del proyecto no necesitan instalarse globalmente. Se instalan mediante npm en cada parte del proyecto.

---

## 5. Configuración y desarrollo local

### 5.1. Preparar el repositorio

Clonar el repositorio:

```powershell
git clone https://github.com/germannvrrocalvo/PaginaVenta2.0.git
cd PaginaVenta2.0
```

### 5.2. Configurar el backend

Copiar el archivo de ejemplo de variables de entorno:

```text
backend/.env.example
```

Crear una copia llamada:

```text
backend/.env
```

Completar únicamente los valores locales o de prueba necesarios.

Preparar PostgreSQL utilizando los archivos:

```text
database/Estructura.sql
database/Datos.sql
```

Instalar las dependencias del backend:

```powershell
cd backend
npm ci
```

Ejecutar las pruebas:

```powershell
npm test
```

El backend utiliza Node.js, Express y PostgreSQL.

### 5.3. Ejecutar la tienda online

Desde la raíz del repositorio:

```powershell
cd frontend
npm ci
npm run dev
```

Vite inicia el entorno de desarrollo, normalmente en:

```text
http://localhost:5173
```

El backend está configurado para ejecutarse en:

```text
http://localhost:3000
```

### 5.4. Ejecutar CoreAdmin

Desde la raíz del repositorio:

```powershell
cd core-admin
npm ci
npm run dev
```

Vite mostrará en la terminal la dirección local del panel de administración.

Si el puerto predeterminado está ocupado, Vite puede seleccionar otro puerto disponible.

---

## 6. Integración con n8n

La integración permite transmitir los pedidos completados desde la tienda hasta el back-office.

El flujo contempla:

1. Recepción del evento de pedido.
2. Validación de la información recibida.
3. Normalización de los datos.
4. Comprobación de duplicados.
5. Registro del pedido y sus líneas.
6. Registro de la actividad de integración.
7. Respuesta al sistema que origina el evento.

La integración utiliza identificadores de evento y mecanismos de idempotencia para evitar registrar varias veces una misma operación.

### Variables de configuración

Las siguientes variables privadas se configuran en Render o en el entorno correspondiente, nunca directamente en GitHub:

| Variable | Función |
|---|---|
| `N8N_ORDER_WEBHOOK_URL` | URL del webhook de n8n |
| `N8N_ORDER_WEBHOOK_SECRET` | Secreto de autenticación |
| `N8N_ORDER_WEBHOOK_TIMEOUT_MS` | Tiempo máximo de espera |
| `N8N_ORDER_WEBHOOK_POLL_INTERVAL_MS` | Intervalo de comprobación |
| `N8N_ORDER_WEBHOOK_MAX_ATTEMPTS` | Número máximo de intentos |

Valores recomendados:

```text
N8N_ORDER_WEBHOOK_TIMEOUT_MS=5000
N8N_ORDER_WEBHOOK_POLL_INTERVAL_MS=10000
N8N_ORDER_WEBHOOK_MAX_ATTEMPTS=8
```

La documentación detallada del contrato JSON y la configuración se encuentra en:

`docs/N8N_PEDIDOS.md`

---

## 7. Escenarios funcionales de la Tarea 2

El prototipo debe contemplar los siguientes escenarios:

### Escenario 1. Registro automático de pedidos

Cuando se completa un pedido en la tienda, la información debe llegar al back-office mediante n8n.

Se deben conservar, como mínimo, los identificadores del pedido y cliente, las líneas, el importe, la fecha y el estado.

### Escenario 2. Sincronización de cambios operativos

Los cambios de estado, disponibilidad, stock o prioridad deben reflejarse en el sistema correspondiente o quedar registrados como operaciones pendientes de sincronización.

### Escenario 3. Incidencias y comunicación postventa

Las incidencias deben asociarse al pedido y al cliente correspondiente.

El sistema debe permitir gestionar la incidencia y generar notificaciones mediante Telegram u otro canal equivalente.

---

## 8. Agente de inteligencia artificial

El proyecto contempla un agente de IA orientado a la gestión operativa del back-office.

Debe disponer de:

- Al menos una herramienta de consulta de información, como pedidos, clientes, incidencias o historial.
- Al menos una herramienta para proponer o ejecutar acciones, como clasificar una incidencia, crear un ticket o preparar una notificación.
- Supervisión humana para aprobar o rechazar las acciones sensibles o irreversibles.

Las respuestas del agente deben permitir identificar:

- Caso detectado.
- Datos consultados.
- Acción propuesta.
- Justificación.
- Confianza o prioridad.
- Riesgos o advertencias.
- Estado final de la operación.

Las propuestas que aparecen en CoreAdmin las genera el agente de n8n y se guardan en `agent_actions` con estado `pending_review`. Desde CoreAdmin se aprueban o rechazan, y quedan registrados el usuario y la fecha de la revisión.

---

## 9. Dashboard y trazabilidad

El cuadro de mando muestra **datos reales** de la base de datos del back-office (`sie-backoffice-db`, Neon), donde escriben los workflows de n8n. No hay cifras introducidas a mano: todo se calcula con las vistas de `database/backoffice/dashboard.sql`.

### 9.1. Cómo funciona

```text
n8n ──escribe──> BD back-office (Neon)
                      │  esquema "dashboard": 10 vistas de solo lectura
                      │  usuario dashboard_reader (solo SELECT sobre las vistas)
                      v
                 Chartbrew (gráficas)
                      │  enlace público de solo lectura
                      v
             CoreAdmin · página Dashboard (iframe)
```

- **Vistas:** `database/backoffice/dashboard.sql` crea el esquema `dashboard`. No modifica ni borra las tablas de `public` y se puede ejecutar varias veces.
- **Usuario de conexión:** `dashboard_reader` solo puede leer las vistas del esquema `dashboard`; no tiene acceso a las tablas ni puede modificar nada. Su contraseña no está en el repositorio.
- **Herramienta:** Chartbrew (SaaS), conectado a Neon por PostgreSQL con SSL.
- **CoreAdmin:** la página **Dashboard** muestra el cuadro de mando en un iframe, con botones para recargarlo, ampliarlo o abrirlo en una pestaña nueva. La URL se puede cambiar con la variable `VITE_DASHBOARD_EMBED_URL`.
- **Zona horaria:** `Europe/Madrid`. **Moneda:** EUR.

### 9.2. Qué muestra

**Indicadores (KPIs):** pedidos totales, importe total (€), ticket medio (€), éxito de la integración (%), aprobación del agente IA (%) e incidencias abiertas.

**Gráficos:**

- Pedidos por día (últimos 30 días).
- Top 5 productos más vendidos.
- Eventos de integración por día (correcto / duplicado / fallido).
- Propuestas del agente IA por estado de revisión.
- Incidencias por estado.
- Tabla de trazabilidad con los últimos 50 eventos de integración (fecha, tipo, workflow, pedido, resultado y tipo de error).

### 9.3. Vistas SQL

| Vista | Qué contiene | Uso en el dashboard |
|---|---|---|
| `dashboard.kpis` | Una fila con todos los indicadores | Tarjetas de KPIs |
| `dashboard.pedidos_por_dia` | Pedidos e importe por día, últimos 30 días (días sin pedidos = 0) | Gráfico de evolución |
| `dashboard.pedidos_por_estado` | Pedidos e importe por `order_status` | Barras o circular |
| `dashboard.productos_mas_vendidos` | Unidades, importe y nº de pedidos por producto | Top 5 productos |
| `dashboard.eventos_por_dia` | Eventos de integración por día y resultado | Barras apiladas |
| `dashboard.errores_por_tipo` | Eventos fallidos agrupados por `error_type` | Tabla de errores |
| `dashboard.incidencias_por_estado` | Incidencias por estado, prioridad y si están abiertas | Incidencias por estado |
| `dashboard.agente_por_estado` | Propuestas del agente por `review_status` y confianza media | Donut del agente IA |
| `dashboard.ultimos_eventos` | Últimos 50 eventos de integración | Tabla de trazabilidad |
| `dashboard.eventos_integracion` | Base: cada log clasificado como correcto / duplicado / fallido | La usan las demás |

### 9.4. Cómo se calculan las métricas

| Métrica | Cálculo | Tabla origen |
|---|---|---|
| Pedidos totales | `count(*)` | `orders` |
| Importe total | `sum(total_amount)` | `orders` |
| Ticket medio | `avg(total_amount)` | `orders` |
| Tiempo medio de integración | Media de `integrated_at - created_at`, en segundos | `orders` |
| Eventos correctos / duplicados / fallidos | `integration_status`: `completed` = correcto, `already_processed` = duplicado, cualquier otro valor = fallido | `integration_logs` |
| Éxito de la integración | (eventos - fallidos) / eventos. Los duplicados cuentan como bien gestionados, porque la idempotencia los descarta a propósito | `integration_logs` |
| Errores por tipo | Eventos fallidos agrupados por `error_type` | `integration_logs` |
| Incidencias abiertas / resueltas | `resolved_at IS NULL` / `IS NOT NULL` | `incidents` |
| Tiempo medio de resolución | Media de `resolved_at - created_at`, en horas | `incidents` |
| Aprobación del agente IA | Propuestas con `review_status` `approved` o `executed` / total | `agent_actions` |
| Productos más vendidos | `sum(quantity)` y `sum(line_total)` por producto | `order_items` |

Si n8n cambia los valores de estado, solo hay que tocar la vista `dashboard.eventos_integracion` (qué es correcto o fallido) y la línea de "aprobadas" de `dashboard.kpis`.

### 9.5. Justificación de las métricas

- **Tráfico y errores de la integración** (eventos por día, éxito de la integración, errores por tipo, tiempo de integración): son tres de las cuatro *señales doradas* para monitorizar sistemas distribuidos (latencia, tráfico, errores y saturación). [Google SRE, *Monitoring Distributed Systems*](https://sre.google/sre-book/monitoring-distributed-systems/).
- **Duplicados como parte del éxito:** la idempotencia evita procesar dos veces la misma operación al reintentar; un reintento detectado y descartado es un funcionamiento correcto. [Stripe, *Idempotent requests*](https://docs.stripe.com/api/idempotent_requests).
- **Incidencias abiertas y tiempo medio de resolución (MTTR):** indicadores clásicos de la gestión de incidencias. [Atlassian, *Common incident management metrics*](https://www.atlassian.com/incident-management/kpis/common-metrics).
- **Pedidos, importe, ticket medio y productos más vendidos:** KPIs básicos de comercio electrónico para medir el volumen y el valor de las ventas. [Shopify, *Average order value*](https://www.shopify.com/blog/average-order-value).
- **Propuestas del agente y tasa de aprobación:** miden la supervisión humana de la IA, exigida en el [Reglamento europeo de IA, art. 14](https://artificialintelligenceact.eu/article/14/) y recomendada en el [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework).

### 9.6. Cómo instalarlo

1. En el SQL Editor de Neon (proyecto `sie-backoffice-db`, base `neondb`), ejecutar `database/backoffice/dashboard.sql`.
2. Crear el usuario de solo lectura con una contraseña generada (no subirla al repositorio):

   ```sql
   CREATE ROLE dashboard_reader WITH LOGIN PASSWORD '<contraseña generada>';
   ```

3. Volver a ejecutar `dashboard.sql` para que se apliquen los permisos al usuario nuevo.
4. En Chartbrew, crear una conexión PostgreSQL con `dashboard_reader` (SSL `require`) y un dataset por vista (`SELECT * FROM dashboard.<vista>`).
5. Crear los gráficos, activar *Allow sharing* en el dashboard y crear un *share link*. Ese enlace va en `VITE_DASHBOARD_EMBED_URL` (o directamente en `core-admin/src/pages/Dashboard.jsx`).

Para quitarlo todo:

```sql
DROP SCHEMA dashboard CASCADE;
DROP ROLE dashboard_reader;
```

### 9.7. Alternativas evaluadas

| Alternativa | Resultado |
|---|---|
| Looker Studio | La conexión con Neon era inestable. Descartada. |
| Grafana Cloud | Funciona con las mismas vistas, pero el plan gratuito no permite incrustarlo en otra web. Se conserva el export en `database/backoffice/grafana-dashboard.json`. |
| Gráficas propias en CoreAdmin | Requerían añadir un endpoint nuevo al backend. |
| **Chartbrew** | **Elegida:** se conecta a Neon con el usuario de solo lectura y permite incrustar el dashboard en CoreAdmin. |

### 9.8. Limitaciones

- Las métricas dependen de los datos que escribe n8n: si una incidencia no rellena `resolved_at`, no cuenta como resuelta. Con pocos datos de prueba, algunas métricas salen a 0.
- Chartbrew guarda en caché los resultados; se pueden refrescar desde el propio dashboard o con el botón *Recargar* de CoreAdmin.
- Chartbrew se usa con la prueba gratuita de 14 días: si caduca, el iframe de CoreAdmin deja de verse y se recurre a las capturas guardadas como evidencia.

---

## 10. Pruebas

Para ejecutar las pruebas automatizadas del backend:

```powershell
cd backend
npm ci
npm test
```

La suite existente comprueba pedidos, autenticación, PayPal Sandbox, contrato `order.created`, autenticación del webhook, timeout, reintentos e idempotencia.

Además, para validar la integración completa se deben preparar y documentar pruebas de los tres escenarios funcionales descritos anteriormente.

Se deben conservar evidencias de las ejecuciones y de los resultados obtenidos en la tienda, n8n y el back-office.

---

## 11. Despliegue

El proyecto contempla el despliegue de los servicios para que puedan utilizarse fuera del entorno local.

- **Render:** despliegue del backend y servicios configurados.
- **Neon:** alojamiento de PostgreSQL.
- **n8n:** ejecución de los workflows de integración.
- **Chartbrew:** cuadro de mando con datos reales, incrustado en CoreAdmin.
- **CoreAdmin:** publicación del panel de administración para acceder al back-office.

El archivo `render.yaml` contiene la configuración de despliegue mediante Blueprint, sin incluir valores secretos.

Las credenciales y variables privadas deben configurarse directamente en los servicios correspondientes.

---

## 12. Entregables de la práctica

La entrega debe reunir los elementos necesarios para demostrar el funcionamiento y justificar las decisiones técnicas:

- URLs de acceso a los servicios desplegados.
- Repositorio GitHub con el código fuente.
- Código fuente comprimido.
- README con instrucciones de instalación y ejecución.
- Workflow de n8n exportado y documentado.
- Tres payloads de prueba.
- Evidencias de ejecución de los escenarios funcionales.
- Evidencias del back-office antes y después de las operaciones.
- Dashboard con métricas y gráfico.
- Matriz comparativa de al menos dos alternativas tecnológicas.
- Memoria técnica en PDF de entre 8 y 12 páginas.
- Anexo sobre el uso de herramientas de inteligencia artificial.
- Presentación para la defensa de la práctica.

La matriz tecnológica debe justificar la solución seleccionada considerando funcionalidad, coste, esfuerzo, escalabilidad, integración, seguridad, dependencia del proveedor, mantenimiento, cumplimiento, trazabilidad y evolución.

---

## 13. Seguridad y alcance académico

El repositorio no debe contener:

- Credenciales reales.
- Archivos `.env`.
- Contraseñas o tokens.
- Datos personales reales de clientes.

Las pruebas deben realizarse con información ficticia o de prueba.

La tienda y sus integraciones constituyen un prototipo académico sin actividad comercial real.

No se deben subir secretos a GitHub ni incluirlos directamente en el código fuente.

---

## 14. Recomendaciones para colaboradores

Para trabajar con el proyecto:

1. Clonar el repositorio.
2. Instalar una versión compatible de Node.js y Git.
3. Instalar las dependencias de la parte que se vaya a desarrollar mediante `npm ci`.
4. Configurar las variables de entorno locales.
5. Consultar la documentación de `docs/N8N_PEDIDOS.md` antes de modificar la integración.
6. Ejecutar las pruebas antes de enviar cambios.
7. No subir carpetas `node_modules`, archivos `.env` ni credenciales.
