const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { createProductsRouter } = require("./routes/productos.routes");
const { createAuthRouter } = require("./routes/auth.routes");
const { createOrdersRouter } = require("./routes/pedidos.routes");
const { createActivityRouter } = require("./routes/activity.routes");
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
const productos = require("./data/productos");

function createApp(authService = null, {
    paypalService = createPaypalService(),
    receiptEmailService = createReceiptEmailService(),
} = {}) {
    const app = express();
    let pool = null;
    let productService;
    let orderService;
    let activityService;
    let orderEventOutbox = null;
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
        authService = createPostgresAuthService(pool);
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
            (token) => authService.getUserForToken(token)
        );
        ready = Promise.all([
            authService.initialize(),
            pool.query("SELECT codigo FROM producto WHERE activo"),
            pool.query("SELECT paypal_order_id, paypal_capture_id FROM pago LIMIT 0"),
        ]).then(([, result]) => {
            const activeCodes = new Set(result.rows.map((row) => row.codigo));
            const missingProducts = productos.filter((product) => !activeCodes.has(product.id));
            if (missingProducts.length) {
                throw new Error(`Faltan productos del catálogo en PostgreSQL: ${missingProducts.map((product) => product.id).join(", ")}. Ejecuta database/Datos.sql.`);
            }
            orderEventOutbox.start();
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
    app.use("/api", createActivityRouter(activityService, (token) => authService.getUserForToken(token)));
    app.locals.ready = ready;
    app.locals.closeDatabase = async () => {
        orderEventOutbox?.stop();
        await pool?.end();
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
            console.error("No se pudo iniciar PostgreSQL. Comprueba DATABASE_URL y ejecuta database/Estructura.sql y database/Datos.sql:", error);
            await app.locals.closeDatabase();
            process.exitCode = 1;
        });
    } catch (error) {
        console.error("No se pudo configurar PostgreSQL. Comprueba DATABASE_URL:", error);
        process.exitCode = 1;
    }
}

module.exports = { createApp };
