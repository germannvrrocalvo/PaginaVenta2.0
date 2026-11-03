// Alta o actualización del cliente a partir de los datos del evento
async function upsertCliente(db, { email, nombre = null, idExterno = null, telegramChatId = null }) {
  const { rows } = await db.query(
    `INSERT INTO cliente (email, nombre, id_externo, telegram_chat_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET
       nombre           = COALESCE(EXCLUDED.nombre, cliente.nombre),
       id_externo       = COALESCE(EXCLUDED.id_externo, cliente.id_externo),
       telegram_chat_id = COALESCE(EXCLUDED.telegram_chat_id, cliente.telegram_chat_id),
       actualizado_en   = now()
     RETURNING id`,
    [email, nombre, idExterno, telegramChatId == null ? null : String(telegramChatId)],
  )
  return rows[0].id
}

module.exports = { upsertCliente }