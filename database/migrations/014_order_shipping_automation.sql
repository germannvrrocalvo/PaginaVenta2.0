BEGIN;

CREATE TABLE IF NOT EXISTS automation_job_state (
    job_name        VARCHAR(100) PRIMARY KEY,
    last_attempt_at TIMESTAMPTZ,
    last_run_at     TIMESTAMPTZ,
    next_run_at     TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
