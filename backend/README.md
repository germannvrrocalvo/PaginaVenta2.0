# Backend PostgreSQL

The backend now requires a PostgreSQL server at runtime. For local development,
install/start PostgreSQL and set `DATABASE_URL` (tienda) and
`BACKOFFICE_DATABASE_URL` (CoreAdmin, integración, incidencias y agente) in
`backend/.env` to the local connection strings in `.env.example`. Keep
`PGSSL=false` for local servers.
The application does not connect to Supabase unless `DATABASE_URL` is explicitly
configured to point there. Never commit `.env` or share its connection string.

The payment provider is fixed to PayPal's Sandbox API. Create a Sandbox REST
app in the PayPal Developer Dashboard and put its Sandbox client ID and secret
in `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `backend/.env`. Never put
the secret in frontend variables or source files. The public client ID is
served to Checkout by the backend. Test payments require a Sandbox buyer
account; no real charge is made.
The PayPal order includes the saved product names, variants, quantities, prices,
discount and shipping breakdown; the browser never supplies the payment amount
or item details.

For a new, empty database, execute `database/Estructura.sql` and then
`database/Datos.sql` from the repository root. **Estructura.sql drops and
recreates the schema; never run it against a database containing data you need.**
For an existing database created from the previous schema, apply the numbered
scripts `database/migrations/007_paypal.sql` and
`database/migrations/008_paypal_sandbox.sql` instead of rerunning the
destructive schema setup.
The Render startup command applies the idempotent migrations 009 through 012
to the store database and prepares `database/backoffice/schema.sql` plus the
dashboard views in the independent back-office database automatically.

The backend seeds/updates the two demo accounts at startup. Registered users,
hashed sessions, orders, payment references, variant stock, support tickets and
events are stored in PostgreSQL. A startup error is reported if the connection
is missing, the schema is not installed, or the ten catalog products are not
seeded.

After a Sandbox capture, the backend posts the paid order to `N8N_WEBHOOK_URL`
so n8n can send the confirmation and tracking email. If that variable is
omitted, Nodemailer falls back to an Ethereal test inbox, logs its preview URL,
and does not deliver real email.

Independently, every persisted order creates an `order.created` event for the
back-office workflow. Configure `N8N_ORDER_WEBHOOK_URL` and
`N8N_ORDER_WEBHOOK_SECRET` only in the backend environment. The event is stored
in a PostgreSQL outbox in the same transaction as the order, then delivered
asynchronously with timeout, idempotency and retries. An n8n outage never rolls
back a completed purchase. See `docs/N8N_PEDIDOS.md` for the exact Render and
n8n setup and the safe failure test.

The incident back-office calls the n8n AI agent only through the backend. n8n,
CoreAdmin, incidents and `agent_actions` all use `BACKOFFICE_DATABASE_URL`; no
third database is created for the agent.
Configure `N8N_INCIDENT_AGENT_WEBHOOK_URL`,
`N8N_INCIDENT_AGENT_WEBHOOK_HEADER` and
`N8N_INCIDENT_AGENT_WEBHOOK_SECRET` in Render, never in the frontend. The
proposal is stored as `pending_review` and cannot approve itself. See
`docs/N8N_AGENTE_INCIDENCIAS.md`.
