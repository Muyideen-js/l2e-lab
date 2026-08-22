import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pyodideAssetNames = [
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
] as const

const pyodideAssetTypes: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
}

function pyodideAssets(): Plugin {
  const projectRoot = fileURLToPath(new URL('.', import.meta.url))
  const packageRoot = resolve(projectRoot, 'node_modules', 'pyodide')
  const allowed = new Set<string>(pyodideAssetNames)

  return {
    name: 'l2e-local-pyodide-assets',
    configureServer(server) {
      server.middlewares.use('/pyodide', (request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        const assetName = basename(pathname)
        if (!allowed.has(assetName)) {
          next()
          return
        }

        try {
          const extension = assetName.slice(assetName.lastIndexOf('.'))
          response.statusCode = 200
          response.setHeader('Content-Type', pyodideAssetTypes[extension] ?? 'application/octet-stream')
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          response.end(readFileSync(resolve(packageRoot, assetName)))
        } catch (error) {
          next(error as Error)
        }
      })
    },
    generateBundle() {
      pyodideAssetNames.forEach((assetName) => {
        this.emitFile({
          type: 'asset',
          fileName: `pyodide/${assetName}`,
          source: readFileSync(resolve(packageRoot, assetName)),
        })
      })
    },
  }
}

export default defineConfig({
  resolve: {
    // y-monaco still imports Monaco's pre-0.56 ESM subpath. The file remains
    // part of Monaco, but its newer package exports no longer expose that path.
    alias: {
      'monaco-editor/esm/vs/editor/editor.api.js': resolve(
        fileURLToPath(new URL('.', import.meta.url)),
        'node_modules/monaco-editor/esm/vs/editor/editor.api.js',
      ),
    },
  },
  plugins: [
    react(),
    pyodideAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'L2E LAB — Learn2Earn Learning Workspace',
        short_name: 'L2E LAB',
        description: 'A username-based learning workspace for Python practice, daily challenges, and real projects.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f5f8fc',
        theme_color: '#0866e8',
        orientation: 'any',
        icons: [
          {
            src: '/learn2earn-logo.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      includeAssets: ['learn2earn-logo.svg', 'learn2earn-white.png', 'dm-sans.woff2'],
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/pyodide/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pyodide-runtime',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['pyodide'] },
  server: { port: 5173 },
})
