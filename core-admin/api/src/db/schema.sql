-- =====================================================================
--  CoreAdmin · Base de datos PROPIA del back-office (Neon)
--  Independiente de la BD de la tienda. Idempotente: se puede ejecutar
--  varias veces sin perder datos.
-- =====================================================================

-- Usuarios internos del back-office
CREATE TABLE IF NOT EXISTS usuario_admin (
    id             SERIAL PRIMARY KEY,
    email          VARCHAR(254) NOT NULL UNIQUE,
    nombre         VARCHAR(120) NOT NULL,
    password_hash  TEXT         NOT NULL,
    rol            VARCHAR(20)  NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin', 'operador')),
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sesion_admin (
    token_hash  CHAR(64)    PRIMARY KEY,
    usuario_id  INT         NOT NULL REFERENCES usuario_admin(id) ON DELETE CASCADE,
    expira_en   TIMESTAMPTZ NOT NULL,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clientes tal y como los conoce el back-office
CREATE TABLE IF NOT EXISTS cliente (
    id                SERIAL PRIMARY KEY,
    id_externo        VARCHAR(60),
    email             VARCHAR(254) NOT NULL UNIQUE,
    nombre            VARCHAR(120),
    telegram_chat_id  VARCHAR(40),
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedido (
    id                SERIAL PRIMARY KEY,
    numero            VARCHAR(30)   NOT NULL UNIQUE,
    cliente_id        INT           NOT NULL REFERENCES cliente(id),
    total             NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    moneda            CHAR(3)       NOT NULL DEFAULT 'EUR',
    estado            VARCHAR(30)   NOT NULL CHECK (estado IN (
                          'creado','pagado','pendiente_preparacion','enviado',
                          'entregado','cancelado','con_incidencia')),
    fecha_pedido      TIMESTAMPTZ   NOT NULL,
    origen            VARCHAR(30)   NOT NULL DEFAULT 'tienda',
    evento_origen     VARCHAR(160),
    ultimo_evento_en  TIMESTAMPTZ,
    creado_en         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    actualizado_en    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pedido_estado ON pedido(estado);
CREATE INDEX IF NOT EXISTS idx_pedido_fecha  ON pedido(fecha_pedido);

CREATE TABLE IF NOT EXISTS linea_pedido (
    id               SERIAL PRIMARY KEY,
    pedido_id        INT           NOT NULL REFERENCES pedido(id) ON DELETE CASCADE,
    producto_id      VARCHAR(60)   NOT NULL,
    nombre           VARCHAR(200)  NOT NULL,
    cantidad         INT           NOT NULL CHECK (cantidad > 0),
    precio_unitario  NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0)
);
CREATE INDEX IF NOT EXISTS idx_linea_pedido ON linea_pedido(pedido_id);

CREATE TABLE IF NOT EXISTS incidencia (
    id                      SERIAL PRIMARY KEY,
    referencia              VARCHAR(30)  NOT NULL UNIQUE,
    pedido_id               INT          REFERENCES pedido(id) ON DELETE SET NULL,
    numero_pedido_indicado  VARCHAR(30),
    cliente_id              INT          NOT NULL REFERENCES cliente(id),
    tipo                    VARCHAR(30)  NOT NULL DEFAULT 'consulta' CHECK (tipo IN (
                                'consulta','retraso','devolucion','producto_defectuoso','pago','otro')),
    asunto                  VARCHAR(200) NOT NULL,
    descripcion             TEXT         NOT NULL,
    prioridad               VARCHAR(10)  NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja','media','alta')),
    estado                  VARCHAR(12)  NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','en_curso','resuelta','cerrada')),
    canal                   VARCHAR(20)  NOT NULL DEFAULT 'web',
    evento_origen           VARCHAR(160),
    creado_en               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resuelta_en             TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_incidencia_estado ON incidencia(estado);
CREATE INDEX IF NOT EXISTS idx_incidencia_pedido ON incidencia(pedido_id);

-- Mensajes con el cliente (Telegram u otros) asociados a una incidencia
CREATE TABLE IF NOT EXISTS interaccion (
    id             SERIAL PRIMARY KEY,
    incidencia_id  INT          NOT NULL REFERENCES incidencia(id) ON DELETE CASCADE,
    canal          VARCHAR(20)  NOT NULL CHECK (canal IN ('telegram','email','web','interno')),
    direccion      VARCHAR(10)  NOT NULL CHECK (direccion IN ('entrante','saliente')),
    contenido      TEXT         NOT NULL,
    estado         VARCHAR(12)  NOT NULL DEFAULT 'enviado' CHECK (estado IN ('enviado','simulado','recibido','error')),
    propuesta_id   INT,
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interaccion_incidencia ON interaccion(incidencia_id);

-- Historial de cambios de estado (trazabilidad funcional)
CREATE TABLE IF NOT EXISTS historial_estado (
    id               SERIAL PRIMARY KEY,
    entidad          VARCHAR(20)  NOT NULL CHECK (entidad IN ('pedido','incidencia')),
    entidad_id       INT          NOT NULL,
    estado_anterior  VARCHAR(30),
    estado_nuevo     VARCHAR(30)  NOT NULL,
    origen           VARCHAR(20)  NOT NULL CHECK (origen IN ('integracion','backoffice','agente')),
    usuario          VARCHAR(254),
    nota             TEXT,
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_historial_entidad ON historial_estado(entidad, entidad_id);

-- Idempotencia: cada event_id solo se procesa una vez
CREATE TABLE IF NOT EXISTS evento_procesado (
    event_id      VARCHAR(160) PRIMARY KEY,
    tipo_evento   VARCHAR(60)  NOT NULL,
    entidad_ref   VARCHAR(60),
    procesado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Log técnico de todas las ejecuciones (correctas, fallidas, duplicadas...)
CREATE TABLE IF NOT EXISTS registro_integracion (
    id            BIGSERIAL PRIMARY KEY,
    event_id      VARCHAR(160),
    tipo_evento   VARCHAR(60)  NOT NULL,
    origen        VARCHAR(20)  NOT NULL CHECK (origen IN ('n8n','tienda','backoffice','agente')),
    resultado     VARCHAR(20)  NOT NULL CHECK (resultado IN ('correcto','error','duplicado','advertencia','pendiente')),
    codigo_http   INT,
    mensaje       VARCHAR(500),
    tipo_error    VARCHAR(40),
    entidad       VARCHAR(20),
    entidad_ref   VARCHAR(60),
    workflow      VARCHAR(120),
    ejecucion_id  VARCHAR(120),
    payload       JSONB,
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registro_fecha     ON registro_integracion(creado_en);
CREATE INDEX IF NOT EXISTS idx_registro_resultado ON registro_integracion(resultado);

-- Propuestas del agente de IA (salida estructurada + revisión humana)
CREATE TABLE IF NOT EXISTS propuesta_agente (
    id                   SERIAL PRIMARY KEY,
    event_id             VARCHAR(160) UNIQUE,
    tipo_caso            VARCHAR(40)  NOT NULL,
    datos_consultados    JSONB        NOT NULL,
    herramientas_usadas  JSONB        NOT NULL DEFAULT '[]'::jsonb,
    accion_propuesta     TEXT         NOT NULL,
    tipo_accion          VARCHAR(40)  NOT NULL CHECK (tipo_accion IN (
                             'notificar_telegram','cambiar_estado_pedido','clasificar_incidencia',
                             'responder_soporte','crear_tarea','otra')),
    parametros_accion    JSONB        NOT NULL DEFAULT '{}'::jsonb,
    justificacion        TEXT         NOT NULL,
    confianza            NUMERIC(3,2) NOT NULL CHECK (confianza >= 0 AND confianza <= 1),
    prioridad            VARCHAR(10)  NOT NULL CHECK (prioridad IN ('baja','media','alta')),
    riesgos              JSONB        NOT NULL DEFAULT '[]'::jsonb,
    estado               VARCHAR(30)  NOT NULL DEFAULT 'pendiente_revision' CHECK (estado IN (
                             'pendiente_revision','aprobado','rechazado',
                             'ejecutado','ejecutado_simulado','error_ejecucion')),
    pedido_id            INT          REFERENCES pedido(id) ON DELETE SET NULL,
    incidencia_id        INT          REFERENCES incidencia(id) ON DELETE SET NULL,
    modelo               VARCHAR(80),
    ejecucion_id         VARCHAR(120),
    revisado_por         VARCHAR(254),
    revisado_en          TIMESTAMPTZ,
    nota_revision        TEXT,
    ejecutado_en         TIMESTAMPTZ,
    resultado_ejecucion  TEXT,
    creado_en            TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_propuesta_estado ON propuesta_agente(estado);