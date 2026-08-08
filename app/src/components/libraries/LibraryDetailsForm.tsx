import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { Alert, Button, Group, Stack, TextInput, Textarea } from '@mantine/core'
import { z } from 'zod'

import { ApiError } from '#/lib/api'
import { useFieldErrors } from '#/lib/form'
import { cacheLibrary, updateLibrary } from '#/lib/libraries'

import type { Library } from '#/lib/libraries'

// Mirrors the API's own checks in src/routes/libraries.rs. Duplicated on
// purpose: this one is for a fast answer on submit, that one is the rule.
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(120, 'Use at most 120 characters'),
  description: z.string().trim().max(2000, 'Use at most 2000 characters'),
})

/**
 * What a library calls itself, and what it says about itself.
 *
 * Deliberately knows nothing about the router, so it can be exercised without
 * one - the same reason `NewLibraryModal` is separate from its route.
 *
 * The caller must not mount this until `library` has loaded: `useForm` reads
 * `defaultValues` on the first render only, so a form mounted against a
 * half-fetched library keeps empty fields for good, with nothing anywhere to
 * say why. The settings page's pending gate is what makes that safe.
 */
export function LibraryDetailsForm({
  library,
  readOnly = false,
}: Readonly<{
  library: Library
  /** Everything filled in and nothing to press. What a member who is not an
   *  owner sees - the API refuses them anyway, and a form that only fails on
   *  submit is a worse way to find that out. */
  readOnly?: boolean
}>) {
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm({
    defaultValues: {
      name: library.name,
      description: library.description ?? '',
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      setSaved(false)

      const description = value.description.trim()

      try {
        const updated = await updateLibrary(library.id, {
          name: value.name.trim(),
          // Explicitly null rather than omitted: this is the request that
          // *clears* a description, and it should say so.
          description: description || null,
        })

        cacheLibrary(queryClient, updated)
        // Reset onto what the server actually stored, so the form stops calling
        // itself dirty and shows the trimmed values it will have on reload.
        form.reset({
          name: updated.name,
          description: updated.description ?? '',
        })
        setSaved(true)
      } catch (error) {
        setSubmitError(
          error instanceof ApiError
            ? error.message
            : 'Something went wrong. Please try again.',
        )
      }
    },
  })

  const errorFor = useFieldErrors(form)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <Stack gap="md">
        {submitError ? (
          <Alert color="red" title="Could not save the library">
            {submitError}
          </Alert>
        ) : null}

        {saved ? (
          <Alert
            color="green"
            title="Saved"
            withCloseButton
            onClose={() => setSaved(false)}
          />
        ) : null}

        {readOnly ? (
          <Alert color="gray" variant="light">
            Only an owner can change this library&apos;s name or description.
          </Alert>
        ) : null}

        <form.Field name="name">
          {(field) => (
            <TextInput
              label="Name"
              placeholder="My books"
              disabled={readOnly}
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(event.currentTarget.value)
              }
              onBlur={field.handleBlur}
              error={errorFor('name')}
            />
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => (
            <Textarea
              label="Description"
              description="Optional"
              placeholder="Everything on the landing shelf"
              autosize
              minRows={2}
              maxRows={5}
              disabled={readOnly}
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(event.currentTarget.value)
              }
              onBlur={field.handleBlur}
              error={errorFor('description')}
            />
          )}
        </form.Field>

        {readOnly ? null : (
          <Group justify="flex-end">
            <form.Subscribe
              selector={(state) => [state.isSubmitting, state.isDirty] as const}
            >
              {([isSubmitting, isDirty]) => (
                <Button
                  type="submit"
                  loading={isSubmitting}
                  disabled={!isDirty}
                >
                  Save changes
                </Button>
              )}
            </form.Subscribe>
          </Group>
        )}
      </Stack>
    </form>
  )
}
