import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button, Stack, Text, Title } from '@mantine/core'

import { AuthLayout } from '#/components/AuthLayout'
import { CreateAdminForm } from '#/components/CreateAdminForm'

/**
 * First-run setup.
 *
 * There is no guard here: the root route already redirects away from /setup once
 * the instance has been claimed, so by the time this renders there is genuinely
 * nobody to claim it but the visitor.
 */
export const Route = createFileRoute('/setup')({
  component: Setup,
})

function Setup() {
  const [done, setDone] = useState(false)

  return (
    <AuthLayout
      title="Welcome to Tomely"
      subtitle="Let's get your instance set up."
      footer={done ? 'Step 2 of 2' : 'Step 1 of 2'}
    >
      {done ? <Done /> : <CreateAdminForm onCreated={() => setDone(true)} />}
    </AuthLayout>
  )
}

function Done() {
  const navigate = useNavigate()

  return (
    <Stack gap="md">
      <Title order={2} size="h4">
        You&rsquo;re in
      </Title>
      <Text size="sm" c="dimmed">
        Your admin account is ready. More setup steps &mdash; branding, your
        first library, connecting metadata providers &mdash; will live here in
        the future. For now, head to the dashboard and configure them from the
        admin settings whenever you&rsquo;re ready.
      </Text>
      <Button fullWidth onClick={() => void navigate({ to: '/dashboard' })}>
        Go to dashboard
      </Button>
    </Stack>
  )
}
