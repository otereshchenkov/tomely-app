import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import {
  Alert,
  Button,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { z } from 'zod'

import { ApiError, apiFetch } from '#/lib/api'
import { useAuth } from '#/lib/auth'
import { useFieldErrors } from '#/lib/form'
import { setupStatusQueryKey } from '#/lib/setup'

import type { Session } from '#/lib/auth'

// Mirrors the API's own checks in src/routes/setup.rs. Duplicated on purpose:
// this one is for a fast answer on submit, that one is the rule.
const schema = z
  .object({
    displayName: z.string().trim().min(1, 'Display name is required'),
    email: z.email('That does not look like an email address'),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'The two passwords do not match',
    path: ['confirmPassword'],
  })

/**
 * Step one of setup: claim the instance.
 *
 * Its own component rather than part of the route, so it can be exercised
 * without a router around it.
 */
export function CreateAdminForm({
  onCreated,
}: Readonly<{ onCreated: () => void }>) {
  const { signIn } = useAuth()
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      try {
        const session = await apiFetch<Session>('/setup', {
          method: 'POST',
          body: JSON.stringify({
            displayName: value.displayName,
            email: value.email,
            password: value.password,
          }),
        })

        // The API signed us in as part of creating the account, so hold on to
        // the token before showing step two - "Go to dashboard" has to land
        // authenticated.
        signIn(session, true)

        // The root route reads this to decide whether to force /setup, and the
        // query client caches for a minute. Without seeding it, navigating away
        // would read the stale `false` and bounce straight back here.
        queryClient.setQueryData(setupStatusQueryKey, { initialized: true })

        onCreated()
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
        <Stack gap={4}>
          <Title order={2} size="h4">
            Create your admin account
          </Title>
          <Text size="sm" c="dimmed">
            This account is the instance owner with full administrative rights.
          </Text>
        </Stack>

        {submitError ? (
          <Alert color="red" title="Could not create the account">
            {submitError}
          </Alert>
        ) : null}

        <form.Field name="displayName">
          {(field) => (
            <TextInput
              label="Display name"
              placeholder="Jane Doe"
              autoComplete="name"
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(event.currentTarget.value)
              }
              onBlur={field.handleBlur}
              error={errorFor('displayName')}
            />
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <TextInput
              label="Email"
              type="email"
              placeholder="jane@example.com"
              autoComplete="email"
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(event.currentTarget.value)
              }
              onBlur={field.handleBlur}
              error={errorFor('email')}
            />
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <PasswordInput
              label="Password"
              placeholder="at least 8 characters"
              autoComplete="new-password"
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(event.currentTarget.value)
              }
              onBlur={field.handleBlur}
              error={errorFor('password')}
            />
          )}
        </form.Field>

        <form.Field name="confirmPassword">
          {(field) => (
            <PasswordInput
              label="Confirm password"
              autoComplete="new-password"
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(event.currentTarget.value)
              }
              onBlur={field.handleBlur}
              error={errorFor('confirmPassword')}
            />
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" fullWidth loading={isSubmitting}>
              Create admin account
            </Button>
          )}
        </form.Subscribe>
      </Stack>
    </form>
  )
}
