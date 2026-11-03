// Validación sencilla sin dependencias. Devuelve errores { campo, error }
// para que n8n pueda usarlos en su rama de error.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ORDER_RE = /^UC-\d{4}-\d{5}$/

function get(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

const isEmpty = (v) => v === undefined || v === null || v === ''

function createChecker(payload) {
  const errors = []
  const add = (campo, error) => errors.push({ campo, error })

  return {
    errors,
    value: (path) => get(payload, path),

    required(path) {
      const v = get(payload, path)
      if (isEmpty(v) || (typeof v === 'string' && v.trim() === '')) {
        add(path, 'obligatorio')
        return false
      }
      return true
    },

    string(path, { min = 1, max = 10_000, required = true } = {}) {
      const v = get(payload, path)
      if (isEmpty(v)) {
        if (required) add(path, 'obligatorio')
        return
      }
      if (typeof v !== 'string') return add(path, 'debe ser texto')
      const len = v.trim().length
      if (len < min) add(path, `mínimo ${min} caracteres`)
      if (len > max) add(path, `máximo ${max} caracteres`)
    },

    email(path, { required = true } = {}) {
      const v = get(payload, path)
      if (isEmpty(v)) {
        if (required) add(path, 'obligatorio')
        return
      }
      if (typeof v !== 'string' || !EMAIL_RE.test(v.trim())) add(path, 'email no válido')
    },

    orderNumber(path, { required = true } = {}) {
      const v = get(payload, path)
      if (isEmpty(v)) {
        if (required) add(path, 'obligatorio')
        return
      }
      if (typeof v !== 'string' || !ORDER_RE.test(v.trim())) add(path, 'formato esperado UC-AAAA-NNNNN')
    },

    number(path, { min = -Infinity, max = Infinity, required = true, integer = false } = {}) {
      const raw = get(payload, path)
      if (isEmpty(raw)) {
        if (required) add(path, 'obligatorio')
        return
      }
      const v = typeof raw === 'string' ? Number(raw) : raw
      if (typeof v !== 'number' || !Number.isFinite(v)) return add(path, 'debe ser numérico')
      if (integer && !Number.isInteger(v)) add(path, 'debe ser entero')
      if (v < min) add(path, `debe ser >= ${min}`)
      if (v > max) add(path, `debe ser <= ${max}`)
    },

    date(path, { required = true } = {}) {
      const v = get(payload, path)
      if (isEmpty(v)) {
        if (required) add(path, 'obligatorio')
        return
      }
      if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) add(path, 'fecha ISO 8601 no válida')
    },

    oneOf(path, values, { required = true } = {}) {
      const v = get(payload, path)
      if (isEmpty(v)) {
        if (required) add(path, 'obligatorio')
        return
      }
      if (!values.includes(v)) add(path, `valor no permitido (${values.join(', ')})`)
    },

    array(path, { min = 0, max = 500 } = {}) {
      const v = get(payload, path)
      if (!Array.isArray(v)) {
        add(path, 'debe ser una lista')
        return false
      }
      if (v.length < min) add(path, `mínimo ${min} elementos`)
      if (v.length > max) add(path, `máximo ${max} elementos`)
      return true
    },

    custom(path, ok, message) {
      if (!ok) add(path, message)
    },
  }
}

module.exports = { createChecker, EMAIL_RE, ORDER_RE }