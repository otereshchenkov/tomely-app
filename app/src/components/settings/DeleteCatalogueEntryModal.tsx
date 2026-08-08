import { useState } from 'react'
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'

import { ApiError } from '#/lib/api'

import type { CatalogueEntry } from '#/lib/catalogue'

/**
 * Ask before removing a word from the instance's vocabulary, then remove it.
 *
 * Modelled on `DeleteLibraryModal`, with one difference: the request is the
 * caller's, not this component's. A media type and a genre are deleted through
 * different endpoints and forgotten from different caches, and passing the whole
 * of that in is less machinery than teaching this which catalogue it is looking
 * at. Router-free for the same reason every other form here is.
 */
export function DeleteCatalogueEntryModal({
  entry,
  noun,
  opened,
  onClose,
  onConfirm,
}: Readonly<{
  /** Passed whole rather than by id so the dialog can name it. "Delete Manga?"
   *  is a question the reader can answer; "Delete this entry?", asked from a
   *  list of twenty-five, is not. */
  entry: CatalogueEntry
  /** What this catalogue calls one of its rows, lowercase - "media type". */
  noun: string
  opened: boolean
  onClose: () => void
  /** Deletes it and forgets it. Rejecting leaves the dialog open and shown. */
  onConfirm: (entry: CatalogueEntry) => Promise<void>
}>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setError(null)
    setPending(true)

    try {
      await onConfirm(entry)
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
    <Modal opened={opened} onClose={onClose} title={`Delete ${noun}`} centered>
      <Stack gap="md">
        {error ? (
          <Alert color="red" title={`Could not delete the ${noun}`}>
            {error}
          </Alert>
        ) : null}

        <Text fz="sm">
          Delete <b>{entry.name}</b>? It goes from every library on this
          instance, and this cannot be undone.
        </Text>

        <Group justify="flex-end" gap="sm">
          {/* `data-autofocus` on Cancel, not on Delete: Mantine focuses it when
              the dialog opens, and a stray Enter should not be enough to remove
              a word everybody's books are filed under. */}
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
