import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '#/test/render'

import { BooksToolbar } from './BooksToolbar'

// The generic argument rather than an `as` cast: `eslint --fix` strips a
// redundant-looking assertion, and then `.disabled` no longer typechecks.
const button = (name: string) =>
  screen.getByRole<HTMLButtonElement>('button', { name })

const input = (label: string) => screen.getByLabelText<HTMLInputElement>(label)

describe('BooksToolbar', () => {
  it('draws every control the page will have', () => {
    renderWithProviders(<BooksToolbar />)

    expect(input('Search books')).toBeTruthy()
    expect(button('Search')).toBeTruthy()
    expect(input('List view')).toBeTruthy()
    expect(input('Grid view')).toBeTruthy()
    expect(button('Choose columns')).toBeTruthy()
    expect(button('Import CSV')).toBeTruthy()
    expect(button('Add book')).toBeTruthy()
  })

  it('leaves them all disabled, because none of them work yet', () => {
    renderWithProviders(<BooksToolbar />)

    expect(input('Search books').disabled).toBe(true)
    expect(input('List view').disabled).toBe(true)
    expect(input('Grid view').disabled).toBe(true)
    expect(button('Search').disabled).toBe(true)
    expect(button('Choose columns').disabled).toBe(true)
    expect(button('Import CSV').disabled).toBe(true)
    expect(button('Add book').disabled).toBe(true)
  })
})
