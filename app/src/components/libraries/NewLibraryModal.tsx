import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  TextInput,
  Textarea,
} from '@mantine/core'
import { z } from 'zod'

import { ApiError } from '#/lib/api'
import { useFieldErrors } from '#/lib/form'
import { byName, createLibrary, librariesQueryKey } from '#/lib/libraries'

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
 * Create a library.
 *
 * Deliberately knows nothing about the router, so it can be exercised without
 * one - the same reason `CreateAdminForm` is separate from its route.
 */
export function NewLibraryModal({
  opened,
  onClose,
  onCreated,
}: Readonly<{
  opened: boolean
  onClose: () => void
  onCreated?: (library: Library) => void
}>) {
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { name: '', description: '' },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      try {
        const library = await createLibrary({
          name: value.name,
          // The API turns a blank description into null; not sending one at all
          // says the same thing more plainly.
          description: value.description.trim() || undefined,
        })

        // Seed rather than refetch, and re-sort the way the API does, so the new
        // card appears exactly where the next fetch will put it.
        queryClient.setQueryData<Array<Library>>(
          librariesQueryKey,
          (previous) => [...(previous ?? []), library].sort(byName),
        )

        form.reset()
        onCreated?.(library)
        onClose()
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
    <Modal opened={opened} onClose={onClose} title="New library" centered>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <Stack gap="md">
          {submitError ? (
            <Alert color="red" title="Could not create the library">
              {submitError}
            </Alert>
          ) : null}

          <form.Field name="name">
            {(field) => (
              <TextInput
                label="Name"
                placeholder="My books"
                data-autofocus
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
                value={field.state.value}
                onChange={(event) =>
                  field.handleChange(event.currentTarget.value)
                }
                onBlur={field.handleBlur}
                error={errorFor('description')}
              />
            )}
          </form.Field>

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" loading={isSubmitting}>
                  Create library
                </Button>
              )}
            </form.Subscribe>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
