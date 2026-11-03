// Errores con código HTTP para responder siempre con el mismo formato
class HttpError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

class ValidationError extends HttpError {
  constructor(errors) {
    super(422, 'El payload no supera la validación.', { code: 'validacion', details: errors })
  }
}

const fail = (status, message, extra) => {
  throw new HttpError(status, message, extra)
}

module.exports = { HttpError, ValidationError, fail }