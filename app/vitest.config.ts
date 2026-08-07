import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

// A minimal Vitest config independent of the app's Nitro/SSR build so component
// tests run in a plain jsdom environment with the React plugin.
export default defineConfig({
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    execArgv: [
      '--localstorage-file',
      path.resolve(os.tmpdir(), `vitest-${process.pid}.localstorage`),
    ],
  },
})
