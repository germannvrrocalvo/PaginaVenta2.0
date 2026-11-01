BEGIN;

ALTER TABLE pago
    DROP CONSTRAINT IF EXISTS pago_referencia_pago_check;

DO $$
DECLARE
    payment_row RECORD;
    new_reference VARCHAR(10);
BEGIN
    FOR payment_row IN
        SELECT id_pago FROM pago WHERE referencia_pago !~ '^PAY-[A-Z0-9]{6}$'
    LOOP
        LOOP
            new_reference := 'PAY-' || upper(substr(md5(random()::text || clock_timestamp()::text || payment_row.id_pago::text), 1, 6));
            EXIT WHEN NOT EXISTS (SELECT 1 FROM pago WHERE referencia_pago = new_reference);
        END LOOP;
        UPDATE pago SET referencia_pago = new_reference WHERE id_pago = payment_row.id_pago;
    END LOOP;
END;
$$;

ALTER TABLE pago
    ALTER COLUMN referencia_pago TYPE VARCHAR(10);

ALTER TABLE pago
    ADD CONSTRAINT pago_referencia_pago_check
        CHECK (referencia_pago ~ '^PAY-[A-Z0-9]{6}$');

ALTER TABLE pago
    ADD COLUMN IF NOT EXISTS paypal_order_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS paypal_capture_id VARCHAR(64);

ALTER TABLE pedido
    ADD COLUMN IF NOT EXISTS paypal_order_id VARCHAR(64) UNIQUE,
    ADD COLUMN IF NOT EXISTS paypal_request_id VARCHAR(38);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pago_paypal_order
    ON pago (paypal_order_id) WHERE paypal_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pago_paypal_capture
    ON pago (paypal_capture_id) WHERE paypal_capture_id IS NOT NULL;

ALTER TABLE pedido
    DROP CONSTRAINT IF EXISTS pedido_estado_check;

UPDATE pedido SET estado = 'pagado' WHERE estado = 'pagado_simulado';

ALTER TABLE pedido
    ADD CONSTRAINT pedido_estado_check
        CHECK (estado IN ('creado','pagado','pendiente_preparacion',
                          'enviado','entregado','cancelado','con_incidencia'));

DROP INDEX IF EXISTS uq_cliente_email;
CREATE UNIQUE INDEX uq_cliente_email ON cliente (lower(email)) WHERE registrado;
CREATE INDEX IF NOT EXISTS idx_cliente_email_invitado
    ON cliente (lower(email)) WHERE NOT registrado;

COMMIT;
