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

        console.log("Aplicando las migraciones idempotentes de integración de pedidos...");
        for (const migration of [
            "009_order_created_outbox.sql",
            "010_order_status_changed.sql",
            "011_incident_agent.sql",
            "012_separate_backoffice.sql",
            "013_support_requested.sql",
        ]) {
            await pool.query(fs.readFileSync(
                path.join(databaseDir, "migrations", migration),
                "utf8"
            ));
        }

        if (!process.env.BACKOFFICE_DATABASE_URL) {
            throw new Error("BACKOFFICE_DATABASE_URL no está configurada.");
        }
        console.log("Preparando la base de datos independiente del back office...");
        const backofficePool = createPool(
            process.env.BACKOFFICE_DATABASE_URL,
            "BACKOFFICE_DATABASE_URL"
        );
        try {
            await backofficePool.query(fs.readFileSync(
                path.join(databaseDir, "backoffice", "schema.sql"),
                "utf8"
            ));
            await backofficePool.query(fs.readFileSync(
                path.join(databaseDir, "backoffice", "dashboard.sql"),
                "utf8"
            ));
        } finally {
            await backofficePool.end();
        }
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error("No se pudo preparar la base de datos:", error);
    process.exitCode = 1;
});
