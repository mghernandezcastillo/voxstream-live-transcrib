export async function readApiJson<T>(response: Response): Promise<T> {
  const body = await response.text();

  if (!body.trim()) {
    throw new Error(`El servidor devolvió una respuesta vacía (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    if (response.status === 404) {
      throw new Error("La ruta de IA no está disponible en este despliegue (HTTP 404).");
    }

    throw new Error(`El servidor devolvió una respuesta no válida (HTTP ${response.status}).`);
  }
}
