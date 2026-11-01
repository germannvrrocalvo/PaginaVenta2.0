const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

let productosRequest = null;

export function obtenerProductos() {
    if (!productosRequest) {
        productosRequest = fetch(`${API_URL}/productos`)
            .then((respuesta) => {
                if (!respuesta.ok) {
                    throw new Error("No se pudieron obtener los productos");
                }
                return respuesta.json();
            })
            .finally(() => {
                productosRequest = null;
            });
    }

    return productosRequest;
}