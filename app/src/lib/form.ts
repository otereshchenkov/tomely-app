import { useStore } from '@tanstack/react-form'

import type { AnyFormApi } from '@tanstack/react-form'

/**
 * Live per-field error messages for a form.
 *
 * `form.Field`'s render prop does not re-render when a *form-level* validator
 * writes the errors, so reading `field.state.meta.errors` inside it renders
 * every field silently error-free while the form correctly refuses to submit.
 * Subscribing to the form store instead is what makes the messages appear.
 *
 * Cross-field rules - "the two passwords match" - have to live at the form
 * level, so this is the shape every form here needs.
 */
export function useFieldErrors(form: AnyFormApi) {
  const fieldMeta = useStore(form.store, (state) => state.fieldMeta)

  return (name: string): string | undefined => {
    const error = fieldMeta[name]?.errors[0] as
      { message?: string } | string | undefined

    if (!error) return undefined
    return typeof error === 'string' ? error : error.message
  }
}
