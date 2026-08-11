import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      // The package contains top-level await and a threaded Emscripten module.
      // Vite's dev pre-bundler can invalidate its generated URL while a module
      // worker is starting, leaving the worker with a 504 Outdated Optimize Dep.
      // Serving the ESM package directly keeps dev and production equivalent.
      exclude: ['@moonshine-ai/moonshine-wasm'],
    },
    worker: {
      // Moonshine's official Emscripten module uses top-level await.
      format: 'es' as const,
    },
    build: {
      // Required by the official Moonshine WASM bundle. Browsers without
      // top-level await also lack the isolation/threading features it needs.
      target: 'esnext',
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
  };
});
