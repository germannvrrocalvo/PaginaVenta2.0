BEGIN;

ALTER TABLE integration_outbox
    DROP CONSTRAINT IF EXISTS integration_outbox_event_type_check;

ALTER TABLE integration_outbox
    ADD CONSTRAINT integration_outbox_event_type_check
    CHECK (event_type IN ('order.created', 'order.status_changed'));

COMMIT;
