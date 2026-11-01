BEGIN;

ALTER TABLE pedido
    ADD COLUMN IF NOT EXISTS paypal_order_id VARCHAR(64) UNIQUE,
    ADD COLUMN IF NOT EXISTS paypal_request_id VARCHAR(38);

ALTER TABLE pago
    DROP CONSTRAINT IF EXISTS pago_metodo_check,
    ADD CONSTRAINT pago_metodo_check
        CHECK (metodo IN ('paypal_simulado')),
    ADD COLUMN IF NOT EXISTS recibo_enviado_en TIMESTAMPTZ;

COMMIT;
