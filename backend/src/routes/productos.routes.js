const express = require('express')

function createProductsRouter(productService) {
  const router = express.Router()

  router.get('/', async (req, res) => {
    try {
      res.json(await productService.list())
    } catch (error) {
      console.error('Error consultando el catálogo:', error)
      res.status(500).json({ error: 'No se pudo cargar el catálogo.' })
    }
  })

  return router
}

module.exports = { createProductsRouter }
