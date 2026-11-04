const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { createProductsRouter } = require("./routes/productos.routes");
const { createAuthRouter } = require("./routes/auth.routes");
const { createOrdersRouter } = require("./routes/pedidos.routes");
const { createActivityRouter } = require("./routes/activity.routes");
const { createIncidentsRouter } = require("./routes/incidents.routes");
const { createPaypalRouter } = require("./routes/pagos.routes");
const { createOrderService } = require("./services/pedido");
const { createActivityService } = require("./services/activity");
const { createPool } = require("./db/pool");
const { createPostgresAuthService } = require("./services/auth-postgres");
const { createPostgresOrderService } = require("./services/orders-postgres");
const { createPostgresActivityService } = require("./services/activity-postgres");
const { createPostgresProductService } = require("./services/products-postgres");
const { createPaypalService } = require("./services/paypal");
const { createReceiptEmailService } = require("./services/receipt-email");
const { createOrderEventOutbox } = require("./services/order-event-outbox");
const { createIncidentAgentClient } = require("./services/incident-agent-client");
const { createPostgresIncidentService } = require("./services/incident-postgres");
const { createBackofficeAuthService } = require("./services/backoffice-auth-postgres");
const { createBackofficeActivityService } = require("./services/backoffice-activity-postgres");
const { createBackofficeIncidentSync } = require("./services/backoffice-incident-sync");
const { createBackofficeOrderReconciliation } = require("./services/backoffice-order-reconciliation");
const { createAgentActionOutbox } = require("./services/agent-action-outbox");
const { createBackofficeAuthRouter } = require("./routes/backoffice-auth.routes");
const { createBackofficeRouter } = require("./routes/backoffice.routes");
const productos = require("./data/productos");

function createApp(authService = null, {
    paypalService = createPaypalService(),
    receiptEmailService = createReceiptEmailService(),
} = {}) {
    const hasInjectedAuthService = Boolean(authService);
    const app = express();
    let pool = null;
    let backofficePool = null;
    let productService;
    let orderService;
    let activityService;
    let backofficeAuthService = null;
    let backofficeActivityService = null;
    let orderEventOutbox = null;
    let backofficeIncidentSync = null;
    let backofficeOrderReconciliation = null;
    let agentActionOutbox = null;
    let incidentService = null;
    let ready = Promise.resolve();

    if (authService) {
        productService = { list: async () => productos };
        orderService = createOrderService({
            products: productos,
            getUserForToken: (token) => authService.getUserForToken(token),
        });
        activityService = createActivityService({
            getUserForToken: (token) => authService.getUserForToken(token),
        });
    } else {
        pool = createPool();
        backofficePool = createPool(
            process.env.BACKOFFICE_DATABASE_URL,
            "BACKOFFICE_DATABASE_URL"
        );
        authService = createPostgresAuthService(pool);
        backofficeAuthService = createBackofficeAuthService(backofficePool);
        backofficeActivityService = createBackofficeActivityService(backofficePool);
        backofficeIncidentSync = createBackofficeIncidentSync(pool, backofficeActivityService);
        backofficeOrderReconciliation = createBackofficeOrderReconciliation(pool, backofficePool);
        agentActionOutbox = createAgentActionOutbox(backofficePool);
        productService = createPostgresProductService(pool, productos);
        orderEventOutbox = createOrderEventOutbox(pool);
        orderService = createPostgresOrderService(
            pool,
            productos,
            (token) => authService.getUserForToken(token),
            orderEventOutbox
        );
        activityService = createPostgresActivityService(
            pool,
            (token) => authService.getUserForToken(token),
            backofficeIncidentSync,
            orderEventOutbox
        );
        incidentService = createPostgresIncidentService(
            backofficePool,
            createIncidentAgentClient(),
            agentActionOutbox
        );
        ready = Promise.all([
            authService.initialize(),
            backofficeAuthService.initialize(),
            pool.query("SELECT codigo FROM producto WHERE activo"),
            pool.query("SELECT paypal_order_id, paypal_capture_id FROM pago LIMIT 0"),
            backofficePool.query("SELECT incident_id FROM incidents LIMIT 0"),
            backofficePool.query("SELECT order_id FROM orders LIMIT 0"),
        ]).then(([, , result]) => {
            const activeCodes = new Set(result.rows.map((row) => row.codigo));
            const missingProducts = productos.filter((product) => !activeCodes.has(product.id));
            if (missingProducts.length) {
                throw new Error(`Faltan productos del catálogo en PostgreSQL: ${missingProducts.map((product) => product.id).join(", ")}. Ejecuta database/Datos.sql.`);
            }
            orderEventOutbox.start();
            backofficeIncidentSync.start();
            backofficeOrderReconciliation.start();
            agentActionOutbox.start();
        });
    }
    const configuredOrigins = (process.env.FRONTEND_ORIGIN || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    app.use(cors({
        origin(origin, callback) {
            if (!origin || configuredOrigins.length === 0 || configuredOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error("Origen no permitido por CORS"));
        },
    }));
    app.use((req, res, next) => {
        if (typeof process.send === "function") {
            process.send({ type: "http-activity" });
        }
        next();
    });
    app.use(express.json());
    app.use("/api/productos", createProductsRouter(productService));
    app.use("/api/auth", createAuthRouter(authService));
    app.use("/api/pedidos", createOrdersRouter(orderService));
    app.use("/api/pagos", createPaypalRouter({ orderService, paypalService, receiptEmailService }));
    app.use("/api", createActivityRouter(
        activityService,
        (token) => authService.getUserForToken(token),
        { includeAdminRoutes: hasInjectedAuthService }
    ));
    if (backofficeAuthService && backofficeActivityService) {
        app.use("/api/backoffice/auth", createBackofficeAuthRouter(backofficeAuthService));
        app.use("/api/backoffice", createBackofficeRouter(
            backofficeActivityService,
            (token) => backofficeAuthService.getUserForToken(token)
        ));
    }
    if (incidentService) {
        app.use("/api/backoffice/incidencias", createIncidentsRouter(
            incidentService,
            (token) => backofficeAuthService.getUserForToken(token)
        ));
    }
    app.locals.ready = ready;
    app.locals.closeDatabase = async () => {
        orderEventOutbox?.stop();
        backofficeIncidentSync?.stop();
        backofficeOrderReconciliation?.stop();
        agentActionOutbox?.stop();
        await pool?.end();
        await backofficePool?.end();
    };
    app.get("/", (req, res) => {
        res.json({
            mensaje: "Backend de PaginaVenta funcionando correctamente"
        });
    });
    app.get("/health", (req, res) => {
        res.json({ estado: "ok" });
    });
    return app;
}

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    try {
        const app = createApp();
        app.locals.ready.then(() => {
            app.listen(PORT, "0.0.0.0", () => {
                console.log(`Servidor ejecutándose en el puerto ${PORT}`);
            });
        }).catch(async (error) => {
            console.error("No se pudo iniciar PostgreSQL. Comprueba DATABASE_URL y BACKOFFICE_DATABASE_URL y aplica sus migraciones:", error);
            await app.locals.closeDatabase();
            process.exitCode = 1;
        });
    } catch (error) {
        console.error("No se pudo configurar PostgreSQL. Comprueba DATABASE_URL y BACKOFFICE_DATABASE_URL:", error);
        process.exitCode = 1;
    }
}

module.exports = { createApp };
