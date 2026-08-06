import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
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
    proxy: {
      // Keeps dev on a single origin so the browser never hits CORS. In
      // production the browser talks to the API's own origin (VITE_API_URL)
      // and the axum CorsLayer handles it. See src/lib/api.ts.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})

export default config
