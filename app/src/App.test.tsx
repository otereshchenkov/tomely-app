import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { Button } from '@mantine/core'

import { renderWithProviders } from './test/render'

describe('renderWithProviders', () => {
  it('renders Mantine components with the app theme', () => {
    renderWithProviders(<Button>Add a book</Button>)

    const button = screen.getByRole('button', { name: 'Add a book' })
    expect(button.className).toContain('mantine-Button-root')
  })
})
