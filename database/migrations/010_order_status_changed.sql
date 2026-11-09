
BEGIN;

-- Eliminar la restricción anterior
ALTER TABLE integration_outbox
    DROP CONSTRAINT IF EXISTS
    integration_outbox_event_type_check;

-- Crear la restricción compatible con todos
-- los tipos de eventos existentes
ALTER TABLE integration_outbox
    ADD CONSTRAINT integration_outbox_event_type_check
    CHECK (
        event_type IN (
            'order.created',
            'order.status_changed',
            'support.requested'
        )
    );

COMMIT;
