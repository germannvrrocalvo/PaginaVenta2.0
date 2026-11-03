BEGIN;

-- La tienda conserva el ticket original y el estado de entrega hacia la BD
-- independiente del back office. Los reintentos no bloquean al cliente.
ALTER TABLE incidencia
    ADD COLUMN IF NOT EXISTS backoffice_sync_status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE incidencia
    ADD COLUMN IF NOT EXISTS backoffice_sync_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE incidencia
    ADD COLUMN IF NOT EXISTS backoffice_sync_error TEXT;
ALTER TABLE incidencia
    ADD COLUMN IF NOT EXISTS backoffice_synced_at TIMESTAMPTZ;
ALTER TABLE incidencia
    ADD COLUMN IF NOT EXISTS backoffice_next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_incidencia_backoffice_sync_due
    ON incidencia(backoffice_sync_status, backoffice_next_attempt_at);

COMMIT;
