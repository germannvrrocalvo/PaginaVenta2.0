const fs = require("node:fs");
const path = require("node:path");
const { createPool } = require("../src/db/pool");

async function main() {
    if (process.env.AUTO_INIT_DB !== "true") {
        console.log("Inicialización automática de PostgreSQL desactivada.");
        return;
    }

    const pool = createPool();
    const databaseDir = path.resolve(__dirname, "../../database");

    try {
        const tableCheck = await pool.query("SELECT to_regclass('public.producto') AS table_name");

        if (!tableCheck.rows[0].table_name) {
            console.log("Creando la estructura de la base de datos...");
            await pool.query(fs.readFileSync(path.join(databaseDir, "Estructura.sql"), "utf8"));
        }

        const productCount = await pool.query("SELECT COUNT(*)::int AS total FROM producto");
        if (productCount.rows[0].total === 0) {
            console.log("Cargando el catálogo inicial...");
            await pool.query(fs.readFileSync(path.join(databaseDir, "Datos.sql"), "utf8"));
        } else {
            console.log("La base de datos ya contiene datos; no se modifica.");
        }

        console.log("Aplicando la migración idempotente de eventos order.created...");
        await pool.query(fs.readFileSync(
            path.join(databaseDir, "migrations", "009_order_created_outbox.sql"),
            "utf8"
        ));
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error("No se pudo preparar la base de datos:", error);
    process.exitCode = 1;
});
