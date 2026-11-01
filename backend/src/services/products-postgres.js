function createPostgresProductService(pool, products) {
  async function list() {
    const { rows } = await pool.query(
      `SELECT p.codigo AS product_id, p.activo AS product_active,
              v.codigo AS variant_id, v.stock, v.activo AS variant_active
       FROM producto p
       JOIN variante_producto v ON v.id_producto = p.id_producto
       WHERE p.activo`
    )
    const variantsByProduct = new Map()
    for (const row of rows) {
      const variants = variantsByProduct.get(row.product_id) ?? new Map()
      variants.set(row.variant_id ?? '', { stock: row.stock, active: row.variant_active })
      variantsByProduct.set(row.product_id, variants)
    }
    return products
      .filter((product) => variantsByProduct.has(product.id))
      .map((product) => {
        const variants = variantsByProduct.get(product.id)
        const baseVariant = variants.get('')
        return {
          ...product,
          stock: baseVariant?.active ? baseVariant.stock : 0,
          variants: product.variants?.filter((variant) => variants.get(variant.id)?.active)
            .map((variant) => ({
              ...variant,
              stock: variants.get(variant.id).stock,
            })),
        }
      })
  }

  return { list }
}

module.exports = { createPostgresProductService }
