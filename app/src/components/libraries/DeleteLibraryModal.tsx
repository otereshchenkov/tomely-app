import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'

import { ApiError } from '#/lib/api'
import { deleteLibrary, forgetLibrary } from '#/lib/libraries'

import type { Library } from '#/lib/libraries'

/**
 * Ask before deleting a library, then delete it.
 *
 * It owns the request and the cache cleanup rather than taking an `onConfirm`,
 * because both callers would otherwise repeat the same try/catch, the same
 * pending flag and the same two cache writes. What it deliberately does not own
 * is where to go afterwards: the grid stays where it is, the settings page
 * cannot. Keeping that out here is also what lets it be tested without a
 * router - the same reason `NewLibraryModal` knows nothing about one.
 */
export function DeleteLibraryModal({
  library,
  opened,
  onClose,
  onDeleted,
}: Readonly<{
  /** Passed whole rather than by id so the dialog can name it. "Delete Loft?"
   *  is a question the reader can answer; "Delete this library?", asked from a
   *  grid of six, is not. */
  library: Library
  opened: boolean
  onClose: () => void
  /** Called once the row is gone and both caches have forgotten it. */
  onDeleted?: (library: Library) => void
}>) {
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setError(null)
    setPending(true)

    try {
      await deleteLibrary(library.id)
      forgetLibrary(queryClient, library.id)
      onDeleted?.(library)
      onClose()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Delete library" centered>
      <Stack gap="md">
        {error ? (
          <Alert color="red" title="Could not delete the library">
            {error}
          </Alert>
        ) : null}

        <Text fz="sm">
          Delete <b>{library.name}</b>? Everything in it goes with it, and this
          cannot be undone.
        </Text>

        <Group justify="flex-end" gap="sm">
          {/* `data-autofocus` on Cancel, not on Delete: Mantine focuses it when
              the dialog opens, and a stray Enter should not be enough to
              destroy a library. */}
          <Button variant="default" data-autofocus onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" loading={pending} onClick={() => void confirm()}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
