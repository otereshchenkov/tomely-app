import { useState } from 'react'
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'

import { ApiError } from '#/lib/api'

import type { Tag } from '#/lib/tags'

/**
 * Ask before taking a tag off everything it is on, then take it off.
 *
 * The same shape as `DeleteCatalogueEntryModal` - the request is the caller's,
 * not this component's - and one difference in what it says. Deleting a media
 * type is refused while books are filed under it; deleting a tag is *defined* as
 * removing it from them, so the warning has to be about the library rather than
 * about the instance.
 */
export function DeleteTagModal({
  tag,
  opened,
  onClose,
  onConfirm,
}: Readonly<{
  /** Passed whole rather than by id so the dialog can name it. */
  tag: Tag
  opened: boolean
  onClose: () => void
  /** Deletes it and forgets it. Rejecting leaves the dialog open and shown. */
  onConfirm: (tag: Tag) => Promise<void>
}>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setError(null)
    setPending(true)

    try {
      await onConfirm(tag)
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
    <Modal opened={opened} onClose={onClose} title="Delete tag" centered>
      <Stack gap="md">
        {error ? (
          <Alert color="red" title="Could not delete the tag">
            {error}
          </Alert>
        ) : null}

        <Text fz="sm">
          Delete <b>{tag.name}</b>? It comes off every book, shelf, loan and
          member in this library, and this cannot be undone.
        </Text>

        <Group justify="flex-end" gap="sm">
          {/* `data-autofocus` on Cancel, not on Delete: Mantine focuses it when
              the dialog opens, and a stray Enter should not be enough to strip a
              tag off everything that carries it. */}
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
