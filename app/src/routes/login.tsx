import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import {
  Alert,
  Button,
  Checkbox,
  PasswordInput,
  Stack,
  TextInput,
} from '@mantine/core'
import { z } from 'zod'

import { AuthLayout } from '#/components/AuthLayout'
import { ApiError, apiFetch } from '#/lib/api'
import { useAuth } from '#/lib/auth'
import { useFieldErrors } from '#/lib/form'

import type { Session } from '#/lib/auth'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  component: Login,
})

const schema = z.object({
  email: z.email('Enter your email address'),
  password: z.string().min(1, 'Enter your password'),
  rememberMe: z.boolean(),
})

function Login() {
  const { status, signIn } = useAuth()
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const destination = redirect ?? '/dashboard'

  // Someone who is already signed in has no business on this page - including
  // the visitor the root route sent here from /setup. Runs in an effect because
  // the session is only known once the client has read the token.
  useEffect(() => {
    if (status === 'authenticated') {
      void navigate({ to: destination, replace: true })
    }
  }, [status, navigate, destination])

  const form = useForm({
    defaultValues: { email: '', password: '', rememberMe: true },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      try {
        const session = await apiFetch<Session>('/auth/login', {
          method: 'POST',
          body: JSON.stringify(value),
        })

        signIn(session, value.rememberMe)
        await navigate({ to: destination })
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
    <AuthLayout
      title="Tomely"
      subtitle="Sign in to your library"
      footer={import.meta.env.VITE_APP_VERSION}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <Stack gap="md">
          {submitError ? (
            <Alert color="red" title="Could not sign in">
              {submitError}
            </Alert>
          ) : null}

          <form.Field name="email">
            {(field) => (
              <TextInput
                label="Email"
                type="email"
                placeholder="jane@example.com"
                autoComplete="username"
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
                autoComplete="current-password"
                value={field.state.value}
                onChange={(event) =>
                  field.handleChange(event.currentTarget.value)
                }
                onBlur={field.handleBlur}
                error={errorFor('password')}
              />
            )}
          </form.Field>

          <form.Field name="rememberMe">
            {(field) => (
              <Checkbox
                label="Remember me"
                checked={field.state.value}
                onChange={(event) =>
                  field.handleChange(event.currentTarget.checked)
                }
              />
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" fullWidth loading={isSubmitting}>
                Sign in
              </Button>
            )}
          </form.Subscribe>
        </Stack>
      </form>
    </AuthLayout>
  )
}
