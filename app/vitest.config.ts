import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

// A minimal Vitest config independent of the app's Nitro/SSR build so component
// tests run in a plain jsdom environment with the React plugin.
export default defineConfig({
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
