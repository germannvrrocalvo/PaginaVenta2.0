-- =====================================================================
--  UCAM STEREO — PARTE 3: CONSULTAS (mostrar información por pantalla)   v5
--  PostgreSQL 15+ / Supabase — Soluciones Informáticas para la Empresa
--
--  Solo lectura (SELECT). Requiere 01_estructura.sql y 02_datos.sql.
--  En el SQL Editor de Supabase, selecciona una consulta y pulsa
--  "Run selected" (si ejecutas todo, solo se ve el último resultado).
--  En psql:  \i 03_consultas.sql  muestra todos los resultados.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A. CATÁLOGO
-- ---------------------------------------------------------------------

-- A1. Resumen de la base de datos: filas por tabla
SELECT 'categoria' AS tabla, count(*) AS filas FROM categoria
UNION ALL SELECT 'producto',          count(*) FROM producto
UNION ALL SELECT 'variante_producto', count(*) FROM variante_producto
UNION ALL SELECT 'conexion',          count(*) FROM conexion
UNION ALL SELECT 'producto_conexion', count(*) FROM producto_conexion
UNION ALL SELECT 'cliente',           count(*) FROM cliente
UNION ALL SELECT 'sesion',            count(*) FROM sesion
UNION ALL SELECT 'carrito',           count(*) FROM carrito
UNION ALL SELECT 'linea_carrito',     count(*) FROM linea_carrito
UNION ALL SELECT 'pedido',            count(*) FROM pedido
UNION ALL SELECT 'linea_pedido',      count(*) FROM linea_pedido
UNION ALL SELECT 'pago',              count(*) FROM pago
UNION ALL SELECT 'incidencia',        count(*) FROM incidencia
UNION ALL SELECT 'evento',            count(*) FROM evento;

-- A2. Categorías (en el orden de la web)
SELECT orden, slug, nombre, cta, imagen
FROM categoria
ORDER BY orden;

-- A3. Catálogo completo con stock total (suma de sus variantes)
SELECT c.orden, c.nombre AS categoria, p.codigo, p.marca, p.nombre AS producto,
       p.precio AS precio_eur, p.stock_total, p.valoracion, p.num_resenas, p.etiqueta
FROM v_catalogo p
JOIN categoria c ON c.slug = p.categoria
WHERE p.activo
ORDER BY c.orden, p.codigo;

-- A4. Productos destacados (portada)
SELECT codigo, marca, nombre, precio, etiqueta
FROM v_catalogo
WHERE destacado AND activo
ORDER BY valoracion DESC, num_resenas DESC;

-- A5. Número de productos y precio medio por categoría
SELECT c.nombre AS categoria,
       count(p.id_producto)    AS productos,
       round(avg(p.precio), 2) AS precio_medio,
       min(p.precio)           AS precio_min,
       max(p.precio)           AS precio_max
FROM categoria c
LEFT JOIN producto p USING (id_categoria)
GROUP BY c.id_categoria, c.nombre, c.orden
ORDER BY c.orden;

-- A6. Ficha de un producto (cambia el slug)
SELECT p.nombre, p.marca, p.descripcion, p.precio, p.etiqueta,
       p.caracteristicas, p.especificaciones, p.compatibilidad
FROM producto p
WHERE p.slug = 'audio-technica-at-lp120xusb';

-- A7. Conexiones de cada producto (las que declara specs.Conexión)
SELECT p.codigo, p.marca || ' ' || p.nombre AS producto,
       COALESCE(string_agg(co.nombre, ', ' ORDER BY co.nombre), '— (no declara conexiones)') AS conexiones
FROM producto p
LEFT JOIN producto_conexion pc USING (id_producto)
LEFT JOIN conexion co          USING (id_conexion)
GROUP BY p.id_producto, p.codigo, p.marca, p.nombre
ORDER BY p.codigo;

-- A8. Productos por conexión (p. ej. los que tienen Bluetooth)
SELECT p.marca || ' ' || p.nombre AS producto, p.precio
FROM producto p
JOIN producto_conexion pc USING (id_producto)
JOIN conexion co          USING (id_conexion)
WHERE co.nombre = 'Bluetooth'
ORDER BY p.precio;


-- ---------------------------------------------------------------------
-- B. VARIANTES Y STOCK
-- ---------------------------------------------------------------------

-- B1. Variantes de cada producto (clave de carrito del frontend, valor, SKU y stock)
SELECT p.marca || ' ' || p.nombre AS producto,
       CASE WHEN v.es_base THEN p.codigo ELSE p.codigo || ':' || v.codigo END AS clave_carrito,
       p.tipo_variante AS tipo, v.valor, v.sku, v.es_base AS base, p.precio, v.stock
FROM variante_producto v
JOIN producto p USING (id_producto)
WHERE v.activo
ORDER BY p.codigo, v.es_base DESC, v.id_variante;

-- B2. Stock por producto: variante base, resto de variantes y total
SELECT p.codigo, p.nombre,
       sum(v.stock) FILTER (WHERE v.es_base)     AS stock_base,
       sum(v.stock) FILTER (WHERE NOT v.es_base) AS stock_otras_variantes,
       sum(v.stock)                              AS stock_total
FROM producto p
JOIN variante_producto v USING (id_producto)
GROUP BY p.id_producto, p.codigo, p.nombre
ORDER BY p.codigo;

-- B3. Stock bajo (≤ 5 unidades en alguna variante; el frontend marca "low" en ≤ 5)
SELECT p.marca || ' ' || p.nombre AS producto, v.valor AS variante, v.sku, v.stock
FROM variante_producto v
JOIN producto p USING (id_producto)
WHERE v.stock <= 5
ORDER BY v.stock, p.codigo;


-- ---------------------------------------------------------------------
-- C. CLIENTES
-- ---------------------------------------------------------------------

-- C1. Clientes (sin mostrar el hash) y fin de su descuento de bienvenida
SELECT id_cliente, nombre || COALESCE(' ' || apellidos, '') AS cliente, email, rol,
       registrado, newsletter, fecha_creacion AS alta,
       CASE WHEN rol = 'cliente' AND registrado THEN descuento_bienvenida_hasta(fecha_creacion) END AS descuento_hasta,
       CASE WHEN rol = 'cliente' AND registrado
             AND now() < descuento_bienvenida_hasta(fecha_creacion) THEN 'vigente' ELSE 'no aplica' END AS descuento_hoy
FROM cliente
ORDER BY id_cliente;

-- C2. Comprobación de login (devuelve 1 fila si email y contraseña son correctos)
SELECT id_cliente, nombre, rol
FROM cliente
WHERE lower(email) = lower('cliente@ucam.test')
  AND password_hash = crypt('demo1234', password_hash);

-- C3. Pedidos y gasto total por cliente
SELECT c.nombre || COALESCE(' ' || c.apellidos, '') AS cliente, c.email,
       count(pe.id_pedido)        AS pedidos,
       COALESCE(sum(pe.total), 0) AS gasto_total
FROM cliente c
LEFT JOIN pedido pe USING (id_cliente)
GROUP BY c.id_cliente, c.nombre, c.apellidos, c.email
ORDER BY gasto_total DESC, c.id_cliente;


-- ---------------------------------------------------------------------
-- D. CARRITOS
-- ---------------------------------------------------------------------

-- D1. Contenido de los carritos
SELECT ca.id_carrito, ca.estado,
       COALESCE(cl.email, '(anónimo)') AS cliente,
       p.marca || ' ' || p.nombre AS producto,
       p.tipo_variante || ': ' || v.valor AS variante,
       lc.cantidad,
       p.precio * lc.cantidad AS importe
FROM carrito ca
LEFT JOIN cliente   cl ON cl.id_cliente = ca.id_cliente
JOIN linea_carrito  lc ON lc.id_carrito = ca.id_carrito
JOIN variante_producto v ON v.id_variante = lc.id_variante
JOIN producto       p  ON p.id_producto = lc.id_producto
ORDER BY ca.id_carrito, lc.id_lineacarrito;

-- D2. Carritos activos con su total
SELECT ca.id_carrito, cl.email, sum(p.precio * lc.cantidad) AS total_carrito
FROM carrito ca
JOIN cliente cl       ON cl.id_cliente = ca.id_cliente
JOIN linea_carrito lc ON lc.id_carrito = ca.id_carrito
JOIN producto p       ON p.id_producto = lc.id_producto
WHERE ca.estado = 'ACTIVO'
GROUP BY ca.id_carrito, cl.email;


-- ---------------------------------------------------------------------
-- E. PEDIDOS, LÍNEAS, PAGOS E INCIDENCIAS
-- ---------------------------------------------------------------------

-- E1. Pedidos con cliente, estado y desglose económico
--     (numero_visible = cómo lo muestran Confirmacion y Seguimiento)
SELECT pe.numero_pedido, replace(pe.numero_pedido, 'UC-', 'UCS-') AS numero_visible,
       pe.estado, cl.email,
       pe.subtotal, pe.descuento, pe.gastos_envio, pe.total,
       pe.base_imponible, pe.impuesto AS iva_incluido,
       CASE WHEN cl.registrado THEN 'registrado' ELSE 'invitado' END AS tipo_cliente,
       pe.fecha_creacion::date AS fecha
FROM pedido pe
JOIN cliente cl USING (id_cliente)
ORDER BY pe.fecha_creacion;

-- E2. Datos de envío de cada pedido (customer del checkout)
SELECT numero_pedido, envio_nombre, envio_email, envio_telefono, envio_direccion,
       envio_codigopostal, envio_ciudad, envio_provincia, envio_pais
FROM pedido
ORDER BY numero_pedido;

-- E3. Líneas de cada pedido (con la variante comprada)
SELECT pe.numero_pedido, lp.marca, lp.nombre_producto,
       lp.variante_tipo || ': ' || lp.variante_valor AS variante,
       lp.precio_unitario, lp.cantidad, lp.subtotal_linea
FROM linea_pedido lp
JOIN pedido pe USING (id_pedido)
ORDER BY pe.numero_pedido, lp.id_lineapedido;

-- E4. Pedidos con su pago
SELECT pe.numero_pedido, pe.estado AS estado_pedido,
       pg.metodo, pg.importe, pg.resultado, pg.referencia_pago,
       pg.paypal_order_id, pg.paypal_capture_id, pg.fecha_creacion AS fecha_pago
FROM pedido pe
LEFT JOIN pago pg USING (id_pedido)
ORDER BY pe.numero_pedido;

-- E5. Incidencias abiertas o en curso (con o sin pedido)
SELECT i.referencia, COALESCE(i.numero_pedido_indicado, '(sin pedido)') AS pedido_indicado,
       pe.estado AS estado_pedido, i.nombre_contacto, i.email_contacto,
       i.asunto, i.estado, i.fecha_creacion::date AS fecha
FROM incidencia i
LEFT JOIN pedido pe USING (id_pedido)
WHERE i.estado IN ('abierta', 'en_curso')
ORDER BY i.fecha_creacion;

-- E6. Ventas por categoría (solo pedidos no cancelados)
SELECT c.nombre AS categoria,
       sum(lp.cantidad)       AS unidades,
       sum(lp.subtotal_linea) AS ventas_brutas
FROM linea_pedido lp
JOIN pedido    pe ON pe.id_pedido   = lp.id_pedido AND pe.estado <> 'cancelado'
JOIN producto  p  ON p.id_producto  = lp.id_producto
JOIN categoria c  ON c.id_categoria = p.id_categoria
GROUP BY c.id_categoria, c.nombre
ORDER BY ventas_brutas DESC;

-- E7. Facturación total (igual que el panel Admin: pedidos no cancelados)
SELECT count(*) AS pedidos, COALESCE(sum(total), 0) AS facturacion_simulada
FROM pedido
WHERE estado <> 'cancelado';


-- ---------------------------------------------------------------------
-- F. EVENTOS (trazabilidad)
-- ---------------------------------------------------------------------

-- F1. Número de eventos por tipo
SELECT tipo, count(*) AS total
FROM evento
GROUP BY tipo
ORDER BY total DESC, tipo;

-- F2. Recorrido completo ordenado en el tiempo (usuario NULL = visitante anónimo)
SELECT e.fecha_creacion::timestamp(0) AS momento, e.id_sesion_web AS sesion,
       COALESCE(cl.email, '(anónimo)') AS usuario, e.tipo,
       COALESCE(p.codigo, '') AS producto,
       COALESCE(pe.numero_pedido, '') AS pedido,
       e.datos_adicionales AS payload
FROM evento e
LEFT JOIN cliente  cl ON cl.id_cliente = e.id_cliente
LEFT JOIN producto p  ON p.id_producto = e.id_producto
LEFT JOIN pedido   pe ON pe.id_pedido  = e.id_pedido
ORDER BY e.fecha_creacion, e.id_evento;

-- F3. Embudo de conversión: visitas → carrito → checkout → pedido
SELECT
    count(*) FILTER (WHERE tipo = 'product.viewed')       AS productos_vistos,
    count(*) FILTER (WHERE tipo = 'cart.item_added')      AS anadidos_al_carrito,
    count(*) FILTER (WHERE tipo = 'checkout.started')     AS checkouts_iniciados,
    count(*) FILTER (WHERE tipo = 'order.created')        AS pedidos_creados,
    count(*) FILTER (WHERE tipo = 'payment.simulated')    AS pagos_simulados,
    count(*) FILTER (WHERE tipo = 'order.status_changed') AS cambios_de_estado,
    count(*) FILTER (WHERE tipo = 'support.requested')    AS solicitudes_soporte
FROM evento;

-- F4. Productos más vistos
SELECT p.marca || ' ' || p.nombre AS producto, count(*) AS visitas
FROM evento e
JOIN producto p USING (id_producto)
WHERE e.tipo = 'product.viewed'
GROUP BY p.id_producto, p.marca, p.nombre
ORDER BY visitas DESC, producto;

-- F5. Variantes más añadidas al carrito (desde el payload del evento)
SELECT e.datos_adicionales ->> 'sku'          AS sku,
       e.datos_adicionales ->> 'variantValue' AS variante,
       sum((e.datos_adicionales ->> 'qty')::int) AS unidades
FROM evento e
WHERE e.tipo = 'cart.item_added'
GROUP BY 1, 2
ORDER BY unidades DESC, sku;

-- F6. Historial de estados de cada pedido (cambios hechos desde el panel Admin)
SELECT e.fecha_creacion::timestamp(0) AS momento,
       e.datos_adicionales ->> 'orderId' AS pedido,
       e.datos_adicionales ->> 'from'    AS desde,
       e.datos_adicionales ->> 'to'      AS hasta,
       cl.email AS hecho_por
FROM evento e
LEFT JOIN cliente cl ON cl.id_cliente = e.id_cliente
WHERE e.tipo = 'order.status_changed'
ORDER BY e.fecha_creacion;


-- ---------------------------------------------------------------------
-- G. VERIFICACIONES DE COHERENCIA (todas deben devolver OK / 0 filas)
-- ---------------------------------------------------------------------

-- G1. El subtotal de cada pedido es la suma de sus líneas
SELECT pe.numero_pedido, pe.subtotal, sum(lp.subtotal_linea) AS suma_lineas,
       CASE WHEN pe.subtotal = sum(lp.subtotal_linea) THEN 'OK' ELSE 'ERROR' END AS resultado
FROM pedido pe
JOIN linea_pedido lp USING (id_pedido)
GROUP BY pe.id_pedido, pe.numero_pedido, pe.subtotal
ORDER BY pe.numero_pedido;

-- G2. Cada pedido pagado (y en preparación, enviado o entregado) tiene su pago aprobado
--     por el importe del pedido. 'con_incidencia' y 'cancelado' se excluyen: pueden
--     ser pedidos con pago rechazado.
SELECT pe.numero_pedido, pe.estado, pe.total, pg.importe
FROM pedido pe
LEFT JOIN pago pg ON pg.id_pedido = pe.id_pedido AND pg.resultado = 'approved'
WHERE pe.estado IN ('pagado', 'pendiente_preparacion', 'enviado', 'entregado')
  AND (pg.id_pago IS NULL OR pg.importe <> pe.total);

-- G3. Descuento aplicado solo a clientes con rol 'cliente' registrados y dentro de su mes
SELECT pe.numero_pedido, cl.email, pe.descuento, pe.fecha_creacion
FROM pedido pe
JOIN cliente cl USING (id_cliente)
WHERE pe.descuento > 0
  AND NOT (cl.rol = 'cliente' AND cl.registrado
           AND pe.fecha_creacion >= cl.fecha_creacion
           AND pe.fecha_creacion <  descuento_bienvenida_hasta(cl.fecha_creacion));

-- G4. Todo producto tiene exactamente una variante base
SELECT p.codigo, count(*) FILTER (WHERE v.es_base) AS bases
FROM producto p
JOIN variante_producto v USING (id_producto)
GROUP BY p.id_producto, p.codigo
HAVING count(*) FILTER (WHERE v.es_base) <> 1;

-- G5. Si un pedido tiene cambios de estado registrados, el actual coincide con el último.
--     (Solo se revisan pedidos con algún evento order.status_changed: registerPayment
-- fija 'pagado' o 'con_incidencia' sin generar ese evento.)
SELECT pe.numero_pedido, pe.estado AS estado_actual, u.hasta AS ultimo_cambio_registrado
FROM pedido pe
JOIN LATERAL (
    SELECT e.datos_adicionales ->> 'to' AS hasta
    FROM evento e
    WHERE e.id_pedido = pe.id_pedido AND e.tipo = 'order.status_changed'
    ORDER BY e.fecha_creacion DESC, e.id_evento DESC
    LIMIT 1
) u ON TRUE
WHERE pe.estado <> u.hasta;

-- G6. Próximo número de pedido que generará la base de datos
--     (is_called = false: la secuencia aún no se ha usado y el siguiente es last_value)
SELECT 'UC-' || to_char(now(), 'YYYY') || '-'
       || lpad((CASE WHEN is_called THEN last_value + 1 ELSE last_value END)::text, 5, '0') AS proximo_numero_pedido
FROM seq_numero_pedido;
