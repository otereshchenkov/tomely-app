import http from 'node:http'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

import type { Plugin } from 'vite'

/**
 * Proxy `/api` to the API in development.
 *
 * This is what keeps the browser on a single origin in dev, so CORS never comes
 * up; in production the browser talks to the API's own origin (VITE_API_URL) and
 * the axum CorsLayer handles it. See app/src/lib/api.ts.
 *
 * Written as a plugin rather than Vite's own `server.proxy` because the nitro
 * dev server answers requests before that runs: with `server.proxy`, `/api/...`
 * never reaches the API at all and is served by the app router instead, which is
 * an confusing failure - an API call comes back as an HTML page. Registering the
 * middleware from a plugin listed *before* `nitro()` puts it first in the chain.
 *
 * Mounting it at `/api` also does the rewrite for free: connect strips the
 * prefix it matched, so `/api/health` arrives here as `/health`, which is the
 * path the API actually serves.
 */
function apiDevProxy(target: string): Plugin {
  return {
    name: 'tomely:api-dev-proxy',
    configureServer(server) {
      const upstream = new URL(target)

      server.middlewares.use('/api', (req, res) => {
        const proxied = http.request(
          {
            protocol: upstream.protocol,
            hostname: upstream.hostname,
            port: upstream.port,
            path: req.url ?? '/',
            method: req.method,
            headers: { ...req.headers, host: upstream.host },
          },
          (response) => {
            res.writeHead(response.statusCode ?? 502, response.headers)
            response.pipe(res)
          },
        )

        proxied.on('error', (error) => {
          // Almost always "the API is not running". Say so as JSON, because the
          // caller is apiFetch and it will try to parse this.
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: 'BadGateway',
              message: `Cannot reach the API at ${target}: ${error.message}`,
            }),
          )
        })

        req.pipe(proxied)
      })
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    apiDevProxy(process.env.API_INTERNAL_URL ?? 'http://localhost:8080'),
    devtools(),
    nitro(),
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart(),
    viteReact(),
  ],
  nitro: {
    // The app is served as a plain Node process in its own container, not as a
    // Lambda behind CloudFront. `npm run build` emits .output/server/index.mjs,
    // which `npm start` runs.
    preset: 'node-server',
  },
  server: {
    port: 3000,
  },
})

export default config
