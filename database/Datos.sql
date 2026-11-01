-- =====================================================================
--  UCAM STEREO — PARTE 2: DATOS (INSERT)                    v5
--  PostgreSQL 15+ / Supabase — Soluciones Informáticas para la Empresa
--
--  BLOQUE 1 — datos maestros copiados tal cual de PaginaVenta
--             (data/products.js y context/AuthContext.jsx): categorías,
--             productos, variantes con su stock, conexiones y cuentas de prueba.
--  BLOQUE 2 — datos de EJEMPLO del flujo de compra (el frontend los genera
--             en tiempo de ejecución; aquí siguen sus formatos y sus reglas
--             de pricing.js). Descuenta stock como completePurchase().
--             Se puede borrar este bloque si solo se quiere el catálogo.
--
--  Requiere haber ejecutado antes 01_estructura.sql.
--  Se puede volver a ejecutar: primero vacía todas las tablas.
-- =====================================================================

BEGIN;

TRUNCATE TABLE evento, incidencia, pago, linea_pedido, pedido,
               linea_carrito, carrito, sesion, producto_conexion,
               variante_producto, conexion, producto, categoria, cliente
RESTART IDENTITY CASCADE;

-- =====================================================================
-- BLOQUE 1 · DATOS MAESTROS (products.js, AuthContext.jsx)
-- =====================================================================

-- Categorías, productos y variantes (generado desde products.js) --------
-- Orden de categorías = orden del array CATEGORIES.
-- Cada producto tiene su variante base (finish/color, stock = product.stock)
-- y las de `variants`. Precio igual en todas las variantes.
INSERT INTO categoria (slug, nombre, descripcion, cta, imagen, orden) VALUES
('vinilos', 'Vinilos', 'Clásicos y modernos en el soporte que los hizo eternos.', 'Explorar vinilos', '/img/referencia/foto-6.webp', 1),
('tocadiscos', 'Tocadiscos', 'El ritual de poner un disco, de principio a fin.', 'Ver tocadiscos', '/img/referencia/foto-0.webp', 2),
('altavoces', 'Altavoces', 'Que el sonido llene la sala como merece.', 'Ver altavoces', '/img/referencia/foto-3.webp', 3),
('auriculares', 'Auriculares', 'Solo tú, la música y ninguna distracción.', 'Ver auriculares', '/img/referencia/foto-5.webp', 4);

INSERT INTO producto (id_categoria, codigo, slug, nombre, marca, descripcion, tipo_variante, precio, imagen,
                      caracteristicas, especificaciones, compatibilidad, valoracion, num_resenas, etiqueta, destacado)
VALUES
-- p001 · Audio-Technica AT-LP120XUSB
((SELECT id_categoria FROM categoria WHERE slug = 'tocadiscos'),
 'p001', 'audio-technica-at-lp120xusb', 'AT-LP120XUSB', 'Audio-Technica',
 'Tocadiscos de tracción directa con salida USB para digitalizar tu colección. Plato de aluminio, control de tono y pitch ajustable.',
 'Acabado', 349, '/img/referencia/foto-0.webp',
 '["Digitaliza tu colección a través de la salida USB.","Selecciona entre tres velocidades de reproducción.","Conecta por RCA gracias al preamplificador integrado."]'::jsonb,
 '{"Tracción":"Directa","Velocidades":"33 1/3, 45 y 78 rpm","Preamplificador":"Phono/Line integrado","Conexión":"RCA + USB","Peso":"10,8 kg"}'::json,
 'Compatible con amplificadores y altavoces activos con entrada RCA o línea.',
 5, 234, 'Más vendido', TRUE),

-- p002 · Sony PS-LX310BT
((SELECT id_categoria FROM categoria WHERE slug = 'tocadiscos'),
 'p002', 'sony-ps-lx310bt', 'PS-LX310BT', 'Sony',
 'Tocadiscos automático de correa con Bluetooth para enviar el sonido a auriculares o altavoces inalámbricos.',
 'Acabado', 249, '/img/referencia/foto-7.avif',
 '["Inicia la reproducción con el funcionamiento automático.","Escucha sin cables con altavoces o auriculares Bluetooth.","Alterna entre 33 1/3 y 45 rpm según el disco."]'::jsonb,
 '{"Tracción":"Correa","Velocidades":"33 1/3 y 45 rpm","Preamplificador":"Integrado","Conexión":"RCA + Bluetooth","Peso":"4,1 kg"}'::json,
 'Compatible con altavoces y auriculares Bluetooth.',
 4, 189, NULL, TRUE),

-- p003 · Pro-Ject Debut Carbon EVO
((SELECT id_categoria FROM categoria WHERE slug = 'tocadiscos'),
 'p003', 'pro-ject-debut-carbon-evo', 'Debut Carbon EVO', 'Pro-Ject',
 'Brazo de carbono de una pieza, plato de 8 mm con alta inercia y cápsula Sumiko Rainier premontada. Cambio de velocidad electrónico.',
 'Acabado', 599, '/img/referencia/foto-1.jpg',
 '["Brazo de carbono y cápsula premontada.","Cambio electrónico de velocidad.","Comprueba si tu amplificador dispone de entrada phono."]'::jsonb,
 '{"Tracción":"Correa","Velocidades":"33 1/3 y 45 rpm","Cápsula":"Sumiko Rainier","Brazo":"Carbono 8,6\"","Peso":"5,5 kg"}'::json,
 'Requiere preamplificador phono si el amplificador no lo incluye.',
 5, 97, 'Premium', TRUE),

-- p004 · Edifier R1280DB
((SELECT id_categoria FROM categoria WHERE slug = 'altavoces'),
 'p004', 'edifier-r1280db', 'R1280DB', 'Edifier',
 'Monitores activos de estantería con entradas ópticas, coaxiales, RCA y Bluetooth. Acabado en madera y mando a distancia.',
 'Acabado', 149, '/img/referencia/foto-2.webp',
 '["Amplificación integrada para una instalación sencilla.","Varias entradas para conectar fuentes digitales y analógicas.","Control a distancia y acabado en madera."]'::jsonb,
 '{"Potencia":"42 W RMS","Respuesta":"55 Hz - 20 kHz","Conexión":"Óptica, coaxial, RCA, Bluetooth 5.0","Tipo":"Activos 2.0","Peso":"6,0 kg (par)"}'::json,
 'Compatible con cualquier tocadiscos con preamplificador integrado.',
 5, 312, NULL, TRUE),

-- p005 · Klipsch R-41PM
((SELECT id_categoria FROM categoria WHERE slug = 'altavoces'),
 'p005', 'klipsch-r-41pm', 'R-41PM', 'Klipsch',
 'Altavoces amplificados con bocina Tractrix y woofer de cobre de 4". Entrada phono integrada para conectar el tocadiscos directamente.',
 'Acabado', 279, '/img/productos/r-41pm.jpg',
 '["Entrada phono para conectar directamente un tocadiscos.","Amplificación integrada y conexión Bluetooth.","Bocina Tractrix y woofer de cobre de 4 pulgadas."]'::jsonb,
 '{"Potencia":"70 W RMS","Respuesta":"54 Hz - 21 kHz","Conexión":"Phono, RCA, USB, Bluetooth","Tipo":"Activos 2.0","Peso":"10,4 kg (par)"}'::json,
 'Entrada phono: conecta tocadiscos sin preamplificador.',
 5, 141, 'Últimas 2', TRUE),

-- p006 · Meze Audio 99 Classics
((SELECT id_categoria FROM categoria WHERE slug = 'auriculares'),
 'p006', 'meze-99-classics', '99 Classics', 'Meze Audio',
 'Auriculares cerrados con almohadillas de piel y estructura de nogal. Cable desmontable, sonido cálido y musical.',
 'Color', 309, '/img/referencia/foto-5.webp',
 '["Diseño cerrado para una escucha personal.","Copas de nogal y cable desmontable.","Conexión mediante jack de 3,5 o 6,3 mm."]'::jsonb,
 '{"Tipo":"Circumaurales cerrados","Impedancia":"32 Ω","Respuesta":"10 Hz - 25 kHz","Conexión":"Jack 3,5 mm / 6,3 mm","Peso":"260 g"}'::json,
 'Compatible con amplificadores de auriculares y salidas de 3,5 mm.',
 5, 88, 'Premium', TRUE),

-- p007 · Sennheiser HD 599
((SELECT id_categoria FROM categoria WHERE slug = 'auriculares'),
 'p007', 'sennheiser-hd-599', 'HD 599', 'Sennheiser',
 'Auriculares abiertos de referencia para escucha larga y cómoda. Sonido amplio y natural.',
 'Color', 129, '/img/productos/hd-599.jpg',
 '["Diseño abierto para una escena sonora amplia.","Pensados para sesiones largas de escucha en casa.","Conexión por cable a tu amplificador o salida de auriculares."]'::jsonb,
 '{"Tipo":"Circumaurales abiertos","Impedancia":"50 Ω","Respuesta":"12 Hz - 38,5 kHz","Conexión":"Jack 3,5 mm / 6,3 mm","Peso":"250 g"}'::json,
 'Compatible con cualquier amplificador o salida de auriculares.',
 4, 203, NULL, FALSE),

-- p008 · Pink Floyd The Dark Side of the Moon (50 Aniversario)
((SELECT id_categoria FROM categoria WHERE slug = 'vinilos'),
 'p008', 'dark-side-of-the-moon-50-aniversario', 'The Dark Side of the Moon (50 Aniversario)', 'Pink Floyd',
 'Reedición en vinilo de 180 g del álbum de 1973 en vinilo de colores, con póster y pegatinas.',
 'Color', 44.99, '/img/productos/dsotm.jpg',
 '["Reedición del álbum de 1973.","Vinilo de 180 gramos con póster y pegatinas.","Reproducción a 33 1/3 rpm."]'::jsonb,
 '{"Formato":"LP 12\"","Peso":"180 g","Año":"1973 (reedición 2023)","Género":"Rock progresivo","Discos":"1"}'::json,
 'Reproducible a 33 1/3 rpm en cualquier tocadiscos.',
 5, 176, 'Edición limitada', TRUE),

-- p009 · Miles Davis Kind of Blue
((SELECT id_categoria FROM categoria WHERE slug = 'vinilos'),
 'p009', 'kind-of-blue-vinilo', 'Kind of Blue', 'Miles Davis',
 'Clásico del jazz modal en vinilo de 180 g con prensado de alta fidelidad.',
 'Color', 27.99, '/img/productos/kind-of-blue.jpg',
 '["Álbum clásico del jazz modal de Miles Davis.","Edición en vinilo de 180 gramos.","Reproducción a 33 1/3 rpm."]'::jsonb,
 '{"Formato":"LP 12\"","Peso":"180 g","Año":"1959","Género":"Jazz","Discos":"1"}'::json,
 'Reproducible a 33 1/3 rpm en cualquier tocadiscos.',
 5, 121, 'Vintage', FALSE),

-- p010 · UCAM Stereo Kit de limpieza para vinilos
((SELECT id_categoria FROM categoria WHERE slug = 'vinilos'),
 'p010', 'kit-limpieza-vinilos', 'Kit de limpieza para vinilos', 'UCAM Stereo',
 'Cepillo de fibra de carbono, líquido limpiador de 250 ml y paño de microfibra.',
 'Color', 24.9, '/img/productos/kit-limpieza.jpg',
 '["Cepillo de fibra de carbono para retirar polvo superficial.","Incluye líquido limpiador y paño de microfibra.","Compatible con discos de 7, 10 y 12 pulgadas."]'::jsonb,
 '{"Contenido":"Cepillo + líquido 250 ml + paño","Uso":"Discos de 7\", 10\" y 12\""}'::json,
 'Apto para vinilos y cápsulas.',
 4, 54, NULL, FALSE);

INSERT INTO variante_producto (id_producto, codigo, es_base, valor, sku, stock)
SELECT p.id_producto, v.codigo, v.es_base, v.valor, v.sku, v.stock
FROM (VALUES
    ('p001', NULL, TRUE, 'Negro mate', 'AT-LP120XUSB', 14),
    ('p001', 'aluminio-cepillado', FALSE, 'Aluminio cepillado', 'AT-LP120XUSB-S', 7),
    ('p002', NULL, TRUE, 'Negro satinado', 'PS-LX310BT', 22),
    ('p002', 'aluminio-cepillado', FALSE, 'Aluminio cepillado', 'PS-LX310BT-S', 11),
    ('p003', NULL, TRUE, 'Lacado negro', 'DEBUT-CARBON-EVO', 6),
    ('p003', 'nogal-natural', FALSE, 'Nogal natural', 'DEBUT-CARBON-EVO-W', 3),
    ('p004', NULL, TRUE, 'Nogal clásico', 'R1280DB', 40),
    ('p004', 'fresno-negro', FALSE, 'Fresno negro', 'R1280DB-BK', 17),
    ('p005', NULL, TRUE, 'Fresno negro', 'R-41PM', 2),
    ('p005', 'nogal-oscuro', FALSE, 'Nogal oscuro', 'R-41PM-W', 5),
    ('p006', NULL, TRUE, 'Nogal y dorado', '99-CLASSICS', 9),
    ('p006', 'nogal-plata', FALSE, 'Nogal y plata', '99-CLASSICS-S', 4),
    ('p007', NULL, TRUE, 'Marfil y marrón', 'HD-599', 25),
    ('p007', 'negro', FALSE, 'Negro', 'HD-599-BK', 13),
    ('p008', NULL, TRUE, 'Negro', 'VIN-DSOTM-50', 12),
    ('p008', 'transparente', FALSE, 'Transparente', 'VIN-DSOTM-50-CL', 6),
    ('p009', NULL, TRUE, 'Negro', 'VIN-KOB-180', 18),
    ('p009', 'azul-cobalto', FALSE, 'Azul cobalto', 'VIN-KOB-180-BL', 8),
    ('p010', NULL, TRUE, 'Negro', 'ACC-CLEAN-01', 60),
    ('p010', 'azul', FALSE, 'Azul', 'ACC-CLEAN-01-BL', 24)
) AS v(codigo_producto, codigo, es_base, valor, sku, stock)
JOIN producto p ON p.codigo = v.codigo_producto;

-- Conexiones: sacadas de specs.Conexión de cada producto -----------------
-- (p003 y los vinilos/accesorio no declaran Conexión en el frontend).
INSERT INTO conexion (nombre) VALUES
('RCA'),
('USB'),
('Bluetooth'),
('Óptica'),
('Coaxial'),
('Phono'),
('Jack 3,5 mm'),
('Jack 6,3 mm');

INSERT INTO producto_conexion (id_producto, id_conexion)
SELECT p.id_producto, c.id_conexion
FROM (VALUES
    ('p001', 'RCA'), ('p001', 'USB'),                                         -- 'RCA + USB'
    ('p002', 'RCA'), ('p002', 'Bluetooth'),                                    -- 'RCA + Bluetooth'
    ('p004', 'Óptica'), ('p004', 'Coaxial'), ('p004', 'RCA'), ('p004', 'Bluetooth'),  -- 'Óptica, coaxial, RCA, Bluetooth 5.0'
    ('p005', 'Phono'), ('p005', 'RCA'), ('p005', 'USB'), ('p005', 'Bluetooth'),       -- 'Phono, RCA, USB, Bluetooth'
    ('p006', 'Jack 3,5 mm'), ('p006', 'Jack 6,3 mm'),                         -- 'Jack 3,5 mm / 6,3 mm'
    ('p007', 'Jack 3,5 mm'), ('p007', 'Jack 6,3 mm')
) AS v(codigo, conexion)
JOIN producto p ON p.codigo = v.codigo
JOIN conexion c ON c.nombre = v.conexion;

-- Cuentas de prueba (TEST_USERS de AuthContext.jsx) ----------------------
-- Contraseñas con hash bcrypt + sal (nunca en texto plano):
--   cliente@ucam.test / demo1234   (rol cliente)
--   admin@ucam.test   / admin1234  (rol admin)
-- fecha_creacion = joinedAt (primer inicio de sesión). El cliente demo
-- tiene descuento de bienvenida hasta descuento_bienvenida_hasta(fecha_creacion).
INSERT INTO cliente (nombre, apellidos, email, telefono, password_hash, registrado, rol, newsletter, fecha_creacion) VALUES
('Cliente Demo', NULL, 'cliente@ucam.test', NULL, crypt('demo1234',  gen_salt('bf')), TRUE, 'cliente', FALSE, '2026-09-25 10:00:00+02'),
('Admin Demo',   NULL, 'admin@ucam.test',   NULL, crypt('admin1234', gen_salt('bf')), TRUE, 'admin',   FALSE, '2026-09-01 10:00:00+02');

-- =====================================================================
-- BLOQUE 2 · DATOS DE EJEMPLO (flujo completo de compra)
--   Reglas de pricing.js: IVA 21 % incluido; envío 6,90 € (gratis si
--   subtotal - descuento >= 300 €); 10 % de descuento a rol 'cliente'
--   durante el mes natural posterior al alta. Los invitados no tienen descuento.
-- =====================================================================

-- Cliente invitado (Checkout sin sesión: customer.guest = true, con newsletter marcado)
INSERT INTO cliente (nombre, apellidos, email, telefono, password_hash, registrado, rol, newsletter, fecha_creacion) VALUES
('Marta', 'Ruiz López', 'marta.ruiz@example.com', '612 345 678', NULL, FALSE, 'cliente', TRUE, '2026-09-28 20:10:00+02');

-- Carritos: tres ya convertidos en pedido y uno activo (ids 1-4 por RESTART IDENTITY)
INSERT INTO carrito (id_cliente, estado, fecha_creacion, fecha_actualizacion) VALUES
((SELECT id_cliente FROM cliente WHERE email = 'cliente@ucam.test'),        'CONVERTIDO', '2026-09-26 18:48:00+02', '2026-09-26 19:05:00+02'),
((SELECT id_cliente FROM cliente WHERE email = 'cliente@ucam.test'),        'CONVERTIDO', '2026-09-29 12:05:00+02', '2026-09-29 12:30:00+02'),
((SELECT id_cliente FROM cliente WHERE email = 'marta.ruiz@example.com'),   'CONVERTIDO', '2026-09-28 19:40:00+02', '2026-09-28 20:10:00+02'),
((SELECT id_cliente FROM cliente WHERE email = 'cliente@ucam.test'),        'ACTIVO',     '2026-09-30 08:40:00+02', '2026-09-30 08:40:00+02');

INSERT INTO linea_carrito (id_carrito, id_producto, id_variante, cantidad)
SELECT v.id_carrito, vp.id_producto, vp.id_variante, v.cantidad
FROM (VALUES
    (1, 'AT-LP120XUSB',    1),
    (1, 'VIN-DSOTM-50',    1),
    (2, 'R1280DB-BK',      1),
    (2, 'ACC-CLEAN-01-BL', 2),
    (3, 'HD-599',          1),
    (3, 'VIN-KOB-180-BL',  1),
    (4, 'R-41PM',          1)
) AS v(id_carrito, sku, cantidad)
JOIN variante_producto vp ON vp.sku = v.sku;

-- Pedidos (importes = computeTotals de pricing.js, comprobados con node).
-- Los números son explícitos; al final se ajusta la secuencia para que el próximo sea UC-AAAA-01004.
-- UC-2026-01001 · cliente demo: 349,00 + 44,99 = 393,99 · -39,40 (10 %) · envío gratis = 354,59
-- UC-2026-01002 · cliente demo: 149,00 + 2 x 24,90 = 198,80 · -19,88 · envío 6,90 = 185,82
-- UC-2026-01003 · invitada:     129,00 + 27,99 = 156,99 · sin descuento · envío 6,90 = 163,89
INSERT INTO pedido (numero_pedido, id_cliente, id_carrito, estado,
                    envio_nombre, envio_email, envio_telefono, envio_direccion, envio_ciudad,
                    envio_provincia, envio_codigopostal, envio_pais,
                    subtotal, descuento, gastos_envio, total, tipo_iva, base_imponible, impuesto,
                    fecha_creacion, fecha_actualizacion)
VALUES
('UC-2026-01001', (SELECT id_cliente FROM cliente WHERE email = 'cliente@ucam.test'), 1, 'enviado',
 'Cliente Demo', 'cliente@ucam.test', '600 000 001', 'Calle Mayor 12, 3ºA', 'Murcia', 'Murcia', '30001', 'España',
 393.99, 39.40, 0.00, 354.59, 21.00, 293.05, 61.54,
 '2026-09-26 19:05:00+02', '2026-09-27 09:15:00+02'),
('UC-2026-01002', (SELECT id_cliente FROM cliente WHERE email = 'cliente@ucam.test'), 2, 'pagado',
 'Cliente Demo', 'cliente@ucam.test', '+34 600 000 001', 'Avenida Juan Carlos I 45', 'Lorca', 'Murcia', '30800', 'España',
 198.80, 19.88, 6.90, 185.82, 21.00, 153.57, 32.25,
 '2026-09-29 12:30:00+02', '2026-09-29 12:30:00+02'),
('UC-2026-01003', (SELECT id_cliente FROM cliente WHERE email = 'marta.ruiz@example.com'), 3, 'con_incidencia',
 'Marta Ruiz López', 'marta.ruiz@example.com', '612 345 678', 'Calle Mayor 8', 'Cartagena', 'Murcia', '30201', 'España',
 156.99, 0.00, 6.90, 163.89, 21.00, 135.45, 28.44,
 '2026-09-28 20:10:00+02', '2026-09-29 10:00:00+02');

SELECT setval('seq_numero_pedido', (SELECT max(right(numero_pedido, 5)::int) FROM pedido));

INSERT INTO linea_pedido (id_pedido, id_producto, id_variante, nombre_producto, marca,
                          variante_tipo, variante_valor, precio_unitario, cantidad)
SELECT pe.id_pedido, p.id_producto, vp.id_variante, p.nombre, p.marca,
       p.tipo_variante, vp.valor, p.precio, v.cantidad
FROM (VALUES
    ('UC-2026-01001', 'AT-LP120XUSB',    1),
    ('UC-2026-01001', 'VIN-DSOTM-50',    1),
    ('UC-2026-01002', 'R1280DB-BK',      1),
    ('UC-2026-01002', 'ACC-CLEAN-01-BL', 2),
    ('UC-2026-01003', 'HD-599',          1),
    ('UC-2026-01003', 'VIN-KOB-180-BL',  1)
) AS v(numero_pedido, sku, cantidad)
JOIN pedido            pe ON pe.numero_pedido = v.numero_pedido
JOIN variante_producto vp ON vp.sku           = v.sku
JOIN producto          p  ON p.id_producto    = vp.id_producto;

-- Pagos simulados (registerPayment: method paypal_simulado, result approved)
INSERT INTO pago (id_pedido, metodo, importe, resultado, referencia_pago, fecha_creacion)
SELECT pe.id_pedido, 'paypal_simulado', pe.total, 'approved', v.ref, pe.fecha_creacion
FROM (VALUES
    ('UC-2026-01001', 'PAY-K3M9X2'),
    ('UC-2026-01002', 'PAY-7QWE4R'),
    ('UC-2026-01003', 'PAY-ZX81LP')
) AS v(numero_pedido, ref)
JOIN pedido pe ON pe.numero_pedido = v.numero_pedido;

-- Stock: completePurchase() descuenta cada línea del stock de su variante
UPDATE variante_producto v
SET stock = v.stock - s.unidades
FROM (SELECT lp.id_variante, sum(lp.cantidad) AS unidades
      FROM linea_pedido lp
      JOIN pedido pe USING (id_pedido)
      WHERE pe.estado <> 'cancelado'
      GROUP BY lp.id_variante) s
WHERE v.id_variante = s.id_variante;

-- Incidencias (tickets de Soporte: pedido opcional, sin sesión)
INSERT INTO incidencia (referencia, id_pedido, numero_pedido_indicado, nombre_contacto, email_contacto,
                        asunto, descripcion, estado, fecha_creacion)
VALUES
('INC-A1B2C3', (SELECT id_pedido FROM pedido WHERE numero_pedido = 'UC-2026-01003'), 'UC-2026-01003',
 'Marta Ruiz López', 'marta.ruiz@example.com', 'Mi pedido no aparece como enviado',
 'Han pasado dos días desde el pago y el estado del pedido sigue sin actualizarse.', 'abierta', '2026-09-29 09:50:00+02'),
('INC-D4E5F6', NULL, NULL,
 'Ana Ficticia', 'cliente@ucam.test', 'Consulta de compatibilidad',
 '¿El tocadiscos Sony PS-LX310BT funciona con los monitores Edifier R1280DB?', 'abierta', '2026-09-30 09:15:00+02');

-- Eventos: mismo formato que trackEvent() (tipo, sesión, usuario, payload).
-- Usuario NULL = visitante anónimo (invitado).
INSERT INTO evento (id_cliente, id_producto, id_pedido, id_sesion_web, tipo, fecha_creacion, datos_adicionales)
SELECT c.id_cliente, p.id_producto, pe.id_pedido, v.sesion, v.tipo, v.fecha::timestamptz, v.datos::jsonb
FROM (VALUES
    -- Pedido UC-2026-01001 (cliente demo)
    ('cliente@ucam.test', 'p001', NULL,            'ses_k3m9x2ab', 'product.viewed',       '2026-09-26 18:48:00+02', '{"productId":"p001","sku":"AT-LP120XUSB","category":"tocadiscos"}'),
    ('cliente@ucam.test', 'p001', NULL,            'ses_k3m9x2ab', 'cart.item_added',      '2026-09-26 18:50:00+02', '{"productId":"p001","sku":"AT-LP120XUSB","variantId":null,"variantType":"Acabado","variantValue":"Negro mate","qty":1,"price":349}'),
    ('cliente@ucam.test', 'p008', NULL,            'ses_k3m9x2ab', 'product.viewed',       '2026-09-26 18:52:00+02', '{"productId":"p008","sku":"VIN-DSOTM-50","category":"vinilos"}'),
    ('cliente@ucam.test', 'p008', NULL,            'ses_k3m9x2ab', 'cart.item_added',      '2026-09-26 18:54:00+02', '{"productId":"p008","sku":"VIN-DSOTM-50","variantId":null,"variantType":"Color","variantValue":"Negro","qty":1,"price":44.99}'),
    ('cliente@ucam.test', NULL,   NULL,            'ses_k3m9x2ab', 'checkout.started',     '2026-09-26 18:58:00+02', '{"items":2}'),
    ('cliente@ucam.test', NULL,   'UC-2026-01001', 'ses_k3m9x2ab', 'order.created',        '2026-09-26 19:05:00+02', '{"orderId":"UC-2026-01001","total":354.59,"lines":2}'),
    ('cliente@ucam.test', NULL,   'UC-2026-01001', 'ses_k3m9x2ab', 'payment.simulated',    '2026-09-26 19:05:00+02', '{"orderId":"UC-2026-01001","paymentId":"PAY-K3M9X2","result":"approved"}'),
    ('admin@ucam.test',   NULL,   'UC-2026-01001', 'ses_q8w7e6rt', 'order.status_changed', '2026-09-27 09:00:00+02', '{"orderId":"UC-2026-01001","from":"pagado","to":"pendiente_preparacion"}'),
    ('admin@ucam.test',   NULL,   'UC-2026-01001', 'ses_q8w7e6rt', 'order.status_changed', '2026-09-27 09:15:00+02', '{"orderId":"UC-2026-01001","from":"pendiente_preparacion","to":"enviado"}'),
    -- Pedido UC-2026-01002 (cliente demo)
    ('cliente@ucam.test', 'p004', NULL,            'ses_h5j2k9lm', 'product.viewed',       '2026-09-29 12:05:00+02', '{"productId":"p004","sku":"R1280DB","category":"altavoces"}'),
    ('cliente@ucam.test', 'p004', NULL,            'ses_h5j2k9lm', 'cart.item_added',      '2026-09-29 12:08:00+02', '{"productId":"p004","sku":"R1280DB-BK","variantId":"fresno-negro","variantType":"Acabado","variantValue":"Fresno negro","qty":1,"price":149}'),
    ('cliente@ucam.test', 'p010', NULL,            'ses_h5j2k9lm', 'product.viewed',       '2026-09-29 12:12:00+02', '{"productId":"p010","sku":"ACC-CLEAN-01","category":"vinilos"}'),
    ('cliente@ucam.test', 'p010', NULL,            'ses_h5j2k9lm', 'cart.item_added',      '2026-09-29 12:14:00+02', '{"productId":"p010","sku":"ACC-CLEAN-01-BL","variantId":"azul","variantType":"Color","variantValue":"Azul","qty":2,"price":24.9}'),
    ('cliente@ucam.test', NULL,   NULL,            'ses_h5j2k9lm', 'checkout.started',     '2026-09-29 12:20:00+02', '{"items":2}'),
    ('cliente@ucam.test', NULL,   'UC-2026-01002', 'ses_h5j2k9lm', 'order.created',        '2026-09-29 12:30:00+02', '{"orderId":"UC-2026-01002","total":185.82,"lines":2}'),
    ('cliente@ucam.test', NULL,   'UC-2026-01002', 'ses_h5j2k9lm', 'payment.simulated',    '2026-09-29 12:30:00+02', '{"orderId":"UC-2026-01002","paymentId":"PAY-7QWE4R","result":"approved"}'),
    -- Pedido UC-2026-01003 (invitada, sin usuario) + su incidencia
    (NULL,               'p007', NULL,            'ses_b4n6v8cx', 'product.viewed',       '2026-09-28 19:40:00+02', '{"productId":"p007","sku":"HD-599","category":"auriculares"}'),
    (NULL,               'p007', NULL,            'ses_b4n6v8cx', 'cart.item_added',      '2026-09-28 19:43:00+02', '{"productId":"p007","sku":"HD-599","variantId":null,"variantType":"Color","variantValue":"Marfil y marrón","qty":1,"price":129}'),
    (NULL,               'p009', NULL,            'ses_b4n6v8cx', 'product.viewed',       '2026-09-28 19:47:00+02', '{"productId":"p009","sku":"VIN-KOB-180","category":"vinilos"}'),
    (NULL,               'p009', NULL,            'ses_b4n6v8cx', 'cart.item_added',      '2026-09-28 19:50:00+02', '{"productId":"p009","sku":"VIN-KOB-180-BL","variantId":"azul-cobalto","variantType":"Color","variantValue":"Azul cobalto","qty":1,"price":27.99}'),
    (NULL,               NULL,   NULL,            'ses_b4n6v8cx', 'checkout.started',     '2026-09-28 19:58:00+02', '{"items":2}'),
    (NULL,               NULL,   'UC-2026-01003', 'ses_b4n6v8cx', 'order.created',        '2026-09-28 20:10:00+02', '{"orderId":"UC-2026-01003","total":163.89,"lines":2}'),
    (NULL,               NULL,   'UC-2026-01003', 'ses_b4n6v8cx', 'payment.simulated',    '2026-09-28 20:10:00+02', '{"orderId":"UC-2026-01003","paymentId":"PAY-ZX81LP","result":"approved"}'),
    (NULL,               NULL,   'UC-2026-01003', 'ses_b4n6v8cx', 'support.requested',    '2026-09-29 09:50:00+02', '{"ticketId":"INC-A1B2C3","orderId":"UC-2026-01003","subject":"Mi pedido no aparece como enviado"}'),
    ('admin@ucam.test',   NULL,   'UC-2026-01003', 'ses_q8w7e6rt', 'order.status_changed', '2026-09-29 10:00:00+02', '{"orderId":"UC-2026-01003","from":"pagado","to":"con_incidencia"}'),
    -- Carrito activo y consulta de soporte sin pedido (cliente demo)
    ('cliente@ucam.test', 'p005', NULL,            'ses_t1y2u3io', 'product.viewed',       '2026-09-30 08:38:00+02', '{"productId":"p005","sku":"R-41PM","category":"altavoces"}'),
    ('cliente@ucam.test', 'p005', NULL,            'ses_t1y2u3io', 'cart.item_added',      '2026-09-30 08:40:00+02', '{"productId":"p005","sku":"R-41PM","variantId":null,"variantType":"Acabado","variantValue":"Fresno negro","qty":1,"price":279}'),
    ('cliente@ucam.test', NULL,   NULL,            'ses_t1y2u3io', 'support.requested',    '2026-09-30 09:15:00+02', '{"ticketId":"INC-D4E5F6","orderId":null,"subject":"Consulta de compatibilidad"}')
) AS v(email, codigo, numero_pedido, sesion, tipo, fecha, datos)
LEFT JOIN cliente  c  ON c.email          = v.email
LEFT JOIN producto p  ON p.codigo         = v.codigo
LEFT JOIN pedido   pe ON pe.numero_pedido = v.numero_pedido;

COMMIT;
