const API_URL = "http://localhost:3000/api";

export async function obtenerProductos() {
    const respuesta = await fetch(`${API_URL}/productos`);

    if (!respuesta.ok) {
        throw new Error("No se pudieron obtener los productos");
    }

    return await respuesta.json();
}
