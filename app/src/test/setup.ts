import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom lacks a few browser APIs that Mantine relies on. The DOM typings claim
// they always exist, so these are installed with defineProperty rather than a
// `if (!window.x)` guard TypeScript would flag as always-false.

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// jsdom has no blob URL store; anything previewing a picked file needs one.
let nextObjectUrl = 0
URL.createObjectURL = () => `blob:mock/${nextObjectUrl++}`
URL.revokeObjectURL = () => {}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})

// An autosizing Textarea re-measures itself once webfonts have loaded, because
// the text it is measuring changes size when they do. jsdom implements no font
// loading API at all, and Mantine reads `document.fonts` without a guard.
Object.defineProperty(document, 'fonts', {
  writable: true,
  value: {
    ready: Promise.resolve(),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  },
})

afterEach(() => {
  cleanup()
})
