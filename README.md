# 🎙️ VoxStream - Transcripción en Vivo & Asistente de Pantalla (AI Exam Helper)

VoxStream es una aplicación web full-stack que permite compartir el audio y la pantalla de cualquier pestaña del navegador (YouTube, Google Meet, Twitch, Zoom, etc.) para obtener **transcripción de voz en vivo procesada localmente con Whisper**, además de **traducción**, **resúmenes ejecutivos** y **consultas visuales con IA** impulsadas por Gemini.

---

## ⚡ Características Principales

- 🎙️ **Transcripción Local en Tiempo Real:** Whisper Tiny procesa el micrófono o la pista compartida dentro del navegador mediante WebGPU o WASM. El modelo se descarga una vez y queda en la caché del navegador.
- 🌐 **Traducción Simultánea:** Traduce automáticamente la conversación al idioma seleccionado.
- ⚡ **Asistente Rápido de Pantalla (Exam Helper):** Captura fotogramas compresos en vivo y responde preguntas visuales (exámenes, fórmulas, gráficas) con ultra bajo consumo de tokens.
- 💬 **Chat Inteligente Multimodal:** Realiza consultas a Gemini combinando la transcripción acumulada y la captura de pantalla actual.
- 📑 **Resumen Ejecutivo:** Genera resúmenes estructurados, puntos clave y listas de acciones con un solo clic.
- 💾 **Exportación Multi-formato:** Descarga tus transcripciones en formatos `.txt`, `.md`, `.srt` (subtítulos con tiempos) y `.json`.

---

## 🚀 Despliegue en Vercel (Paso a Paso)

### 1. Exportar desde Google AI Studio
1. Haz clic en el menú **Settings** (Ajustes) en la esquina superior derecha de AI Studio.
2. Selecciona **Export to GitHub** (o descarga el archivo `.zip`).
3. Confirma la creación del repositorio en tu cuenta de GitHub.

### 2. Conectar a Vercel
1. Ve a [Vercel Dashboard](https://vercel.com/dashboard) e inicia sesión.
2. Haz clic en **Add New...** > **Project**.
3. Importa tu nuevo repositorio de GitHub (`voxstream-live-transcriber`).
4. En la sección **Environment Variables** (Variables de Entorno), agrega:
   - `GEMINI_API_KEY`: necesaria para preguntas, resúmenes, traducción y únicamente como respaldo si Whisper local no puede iniciarse ([consíguela en Google AI Studio](https://aistudio.google.com/)).
5. Haz clic en **Deploy**. ¡Listo!

---

## 🛠️ Desarrollo Local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar clave de API de Gemini en .env
cp .env.example .env
# Agrega GEMINI_API_KEY=tu_api_key

# 3. Iniciar servidor de desarrollo
npm run dev
```

Abre `http://localhost:3000` en tu navegador.
