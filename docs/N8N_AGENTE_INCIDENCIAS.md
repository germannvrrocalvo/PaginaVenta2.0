# Agente de incidencias: tienda, back office y n8n

## Recorrido completo

1. El cliente envía el formulario de soporte de la tienda.
2. El backend guarda el ticket y su UUID de agente en la misma transacción.
3. Un administrador abre **Back-office > Incidencias** y pulsa **Analizar con IA**.
4. El backend autentica al administrador y llama al webhook de n8n. La URL y el
   secreto nunca llegan al navegador.
5. n8n valida el UUID, consulta la incidencia y registra una propuesta en
   `agent_actions` con `review_status = pending_review`.
6. El back office muestra la acción, la justificación, los riesgos y la
   confianza. Una persona debe aprobarla o rechazarla.

## Contrato enviado a n8n

```json
{
  "incident_id": "49a972fb-755f-4a89-8230-df61ff971b28"
}
```

La autenticación se envía en una cabecera configurable. No se guarda ninguna
URL o clave real en el repositorio.

## Variables de Render

- `N8N_INCIDENT_AGENT_WEBHOOK_URL`: **Production URL** del webhook
  `agente-incidencias`.
- `N8N_INCIDENT_AGENT_WEBHOOK_HEADER`: nombre exacto de la cabecera creada en
  la credencial Header Auth de n8n.
- `N8N_INCIDENT_AGENT_WEBHOOK_SECRET`: el mismo valor secreto de esa
  credencial.
- `N8N_INCIDENT_AGENT_TIMEOUT_MS`: `60000`.

Guarda las tres primeras como secretos en Render. No uses una URL de prueba ni
incluyas el secreto en capturas o en la entrega.

## Prueba real desde la tienda

1. Publica el workflow de n8n.
2. Despliega el backend con la migración 011 aplicada.
3. Envía una solicitud desde **Soporte** en la tienda.
4. Inicia sesión como administrador y abre **Incidencias**.
5. Pulsa **Analizar con IA**. Debe aparecer una propuesta pendiente.
6. Apruébala o recházala y comprueba que queda el usuario y la fecha de revisión.
7. Como prueba de fallo, despublica temporalmente el workflow y vuelve a
   analizar una incidencia ya revisada. La compra y los tickets siguen
   funcionando; el error queda visible y se puede reintentar al publicar n8n.

## Evidencias para la entrega

- JSON exportado del workflow sin credenciales.
- Captura de la ejecución correcta y de la rama de UUID inválido.
- Captura del ticket, la propuesta pendiente y la revisión humana.
- Resultado de `npm test` y `npm run build`.
