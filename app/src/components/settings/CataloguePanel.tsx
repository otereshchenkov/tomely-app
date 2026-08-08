import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconCheck, IconPencil, IconTrash, IconX } from '@tabler/icons-react'
import { z } from 'zod'

import { ApiError } from '#/lib/api'
import { useFieldErrors } from '#/lib/form'
import { DeleteCatalogueEntryModal } from './DeleteCatalogueEntryModal'

import classes from './CataloguePanel.module.css'

import type { CatalogueDraft, CatalogueEntry } from '#/lib/catalogue'

// Mirrors the API's own checks in src/routes/catalogue.rs, the way
// `NewLibraryModal`'s schema mirrors `libraries.rs`. Duplicated on purpose: this
// one is for a fast answer on submit, that one is the rule.
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(120, 'Use at most 120 characters'),
  description: z.string().trim().max(2000, 'Use at most 2000 characters'),
})

/**
 * What went wrong, said in words a reader can act on.
 *
 * The 409 is the interesting one. `From<DbErr>` in the API turns the unique
 * index into a conflict carrying Postgres' own message, constraint name and
 * all - correct, and no use to anybody looking at a settings page. A duplicate
 * name is the only conflict either endpoint can produce, so the client is
 * entitled to say so plainly rather than passing the database's words through.
 */
function readable(error: unknown, noun: string): string {
  if (error instanceof ApiError && error.status === 409) {
    return `That ${noun} already exists.`
  }
  if (error instanceof ApiError) return error.message

  return 'Something went wrong. Please try again.'
}

/**
 * One instance-wide catalogue: add to it, rename its entries, remove them.
 *
 * Draws both the media types page and the genres page, which differ only in
 * whether an entry carries a description - so it takes `CatalogueEntry` rather
 * than either concrete type, and the routes hand it their own create, update and
 * delete. Router-free and fetch-free like `BookForm`: the page above owns the
 * queries and the cache, this owns the interaction.
 */
export function CataloguePanel({
  entries,
  noun,
  withDescription = false,
  namePlaceholder,
  descriptionPlaceholder,
  onCreate,
  onUpdate,
  onDelete,
}: Readonly<{
  entries: Array<CatalogueEntry>
  /** What one row is called, lowercase - "media type", "genre". */
  noun: string
  withDescription?: boolean
  namePlaceholder: string
  descriptionPlaceholder?: string
  onCreate: (draft: CatalogueDraft) => Promise<void>
  onUpdate: (id: string, draft: CatalogueDraft) => Promise<void>
  onDelete: (entry: CatalogueEntry) => Promise<void>
}>) {
  // At most one row is being edited at a time: two half-finished renames on
  // screen is a state nobody asked for and every one of them has to be resolved.
  const [editing, setEditing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CatalogueEntry | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  return (
    <>
      <Card withBorder radius="md" padding={0} className={classes.panel} maw={600}>
        <AddEntryForm
          noun={noun}
          withDescription={withDescription}
          namePlaceholder={namePlaceholder}
          descriptionPlaceholder={descriptionPlaceholder}
          onCreate={onCreate}
        />

        {rowError ? (
          <Alert color="red" radius={0} m="md">
            {rowError}
          </Alert>
        ) : null}

        {entries.length === 0 ? (
          <Text fz="sm" c="dimmed" p="md">
            Nothing here yet. Add the first one above.
          </Text>
        ) : null}

        {entries.map((entry) =>
          editing === entry.id ? (
            <EditEntryRow
              key={entry.id}
              entry={entry}
              withDescription={withDescription}
              namePlaceholder={namePlaceholder}
              descriptionPlaceholder={descriptionPlaceholder}
              noun={noun}
              onCancel={() => setEditing(null)}
              onSave={async (draft) => {
                await onUpdate(entry.id, draft)
                setEditing(null)
              }}
            />
          ) : (
            <EntryRow
              key={entry.id}
              entry={entry}
              onEdit={() => {
                setRowError(null)
                setEditing(entry.id)
              }}
              onDelete={() => {
                setRowError(null)
                setDeleting(entry)
              }}
            />
          ),
        )}
      </Card>

      {deleting ? (
        <DeleteCatalogueEntryModal
          entry={deleting}
          noun={noun}
          opened
          onClose={() => setDeleting(null)}
          onConfirm={onDelete}
        />
      ) : null}
    </>
  )
}

/**
 * The add row at the top of the card.
 *
 * Its own form rather than a modal: adding to a list of twenty-five is something
 * a reader does several times in a row, and a dialog that has to be reopened
 * between each one turns a minute of typing into a minute of clicking.
 */
function AddEntryForm({
  noun,
  withDescription,
  namePlaceholder,
  descriptionPlaceholder,
  onCreate,
}: Readonly<{
  noun: string
  withDescription: boolean
  namePlaceholder: string
  descriptionPlaceholder?: string
  onCreate: (draft: CatalogueDraft) => Promise<void>
}>) {
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { name: '', description: '' },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      try {
        await onCreate({
          name: value.name,
          description: withDescription
            ? value.description.trim() || null
            : null,
        })
        form.reset()
      } catch (error) {
        setSubmitError(readable(error, noun))
      }
    },
  })

  const errorFor = useFieldErrors(form)

  return (
    <form
      className={classes.form}
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <Stack gap="xs">
        {submitError ? (
          <Alert color="red" py="xs">
            {submitError}
          </Alert>
        ) : null}

        <Group gap="sm" align="flex-start" wrap="nowrap">
          <form.Field name="name">
            {(field) => (
              <TextInput
                aria-label={`New ${noun} name`}
                placeholder={namePlaceholder}
                flex={1}
                value={field.state.value}
                onChange={(event) =>
                  field.handleChange(event.currentTarget.value)
                }
                onBlur={field.handleBlur}
                error={errorFor('name')}
              />
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" loading={isSubmitting}>
                Add
              </Button>
            )}
          </form.Subscribe>
        </Group>

        {withDescription ? (
          <form.Field name="description">
            {(field) => (
              <TextInput
                aria-label={`New ${noun} description`}
                placeholder={descriptionPlaceholder}
                value={field.state.value}
                onChange={(event) =>
                  field.handleChange(event.currentTarget.value)
                }
                onBlur={field.handleBlur}
                error={errorFor('description')}
              />
            )}
          </form.Field>
        ) : null}
      </Stack>
    </form>
  )
}

/** An entry at rest: what it is called, what it says, and what may be done to it. */
function EntryRow({
  entry,
  onEdit,
  onDelete,
}: Readonly<{
  entry: CatalogueEntry
  onEdit: () => void
  onDelete: () => void
}>) {
  const inUse = entry.bookCount > 0

  return (
    <Group
      className={classes.row}
      justify="space-between"
      align="flex-start"
      wrap="nowrap"
      gap="sm"
    >
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Group gap="xs" wrap="nowrap">
          <Text fz="sm" fw={500} lineClamp={1}>
            {entry.name}
          </Text>
          {inUse ? (
            <Badge size="xs" variant="light" radius="sm">
              {entry.bookCount} {entry.bookCount === 1 ? 'book' : 'books'}
            </Badge>
          ) : null}
        </Group>

        {entry.description ? (
          <Text fz="xs" c="dimmed">
            {entry.description}
          </Text>
        ) : null}
      </Stack>

      <Group gap={4} wrap="nowrap" className={classes.actions}>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={`Rename ${entry.name}`}
          onClick={onEdit}
        >
          <IconPencil size={16} />
        </ActionIcon>

        {/* Disabled rather than hidden, and wrapped so the reason is reachable:
            an action that vanishes leaves the reader to guess why. `Tooltip`
            will not show on a disabled control, hence the span around it. */}
        <Tooltip
          label={`Still assigned to ${entry.bookCount} ${
            entry.bookCount === 1 ? 'book' : 'books'
          }`}
          disabled={!inUse}
          withArrow
        >
          <span>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Delete ${entry.name}`}
              disabled={inUse}
              onClick={onDelete}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </span>
        </Tooltip>
      </Group>
    </Group>
  )
}

/**
 * The same row, being renamed.
 *
 * Inline rather than a dialog: a rename is one word, and the row it belongs to
 * is the context that makes it obvious which one is being changed.
 */
function EditEntryRow({
  entry,
  noun,
  withDescription,
  namePlaceholder,
  descriptionPlaceholder,
  onSave,
  onCancel,
}: Readonly<{
  entry: CatalogueEntry
  noun: string
  withDescription: boolean
  namePlaceholder: string
  descriptionPlaceholder?: string
  onSave: (draft: CatalogueDraft) => Promise<void>
  onCancel: () => void
}>) {
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Mounted only once the row it edits is known, so `defaultValues` - which
  // `useForm` reads on the first render only - is the entry's own text.
  const form = useForm({
    defaultValues: { name: entry.name, description: entry.description ?? '' },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      try {
        await onSave({
          name: value.name,
          description: withDescription
            ? value.description.trim() || null
            : null,
        })
      } catch (error) {
        setSubmitError(readable(error, noun))
      }
    },
  })

  const errorFor = useFieldErrors(form)

  return (
    <form
      className={classes.row}
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      // Escape gets out of a rename the way it gets out of a dialog.
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <Stack gap="xs">
        {submitError ? (
          <Alert color="red" py="xs">
            {submitError}
          </Alert>
        ) : null}

        <Group gap="sm" align="flex-start" wrap="nowrap">
          <form.Field name="name">
            {(field) => (
              <TextInput
                aria-label={`${entry.name} name`}
                placeholder={namePlaceholder}
                data-autofocus
                autoFocus
                flex={1}
                value={field.state.value}
                onChange={(event) =>
                  field.handleChange(event.currentTarget.value)
                }
                onBlur={field.handleBlur}
                error={errorFor('name')}
              />
            )}
          </form.Field>

          <Group gap={4} wrap="nowrap">
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <ActionIcon
                  type="submit"
                  variant="subtle"
                  aria-label={`Save ${entry.name}`}
                  loading={isSubmitting}
                >
                  <IconCheck size={16} />
                </ActionIcon>
              )}
            </form.Subscribe>

            <ActionIcon
              type="button"
              variant="subtle"
              color="gray"
              aria-label={`Cancel renaming ${entry.name}`}
              onClick={onCancel}
            >
              <IconX size={16} />
            </ActionIcon>
          </Group>
        </Group>

        {withDescription ? (
          <form.Field name="description">
            {(field) => (
              <TextInput
                aria-label={`${entry.name} description`}
                placeholder={descriptionPlaceholder}
                value={field.state.value}
                onChange={(event) =>
                  field.handleChange(event.currentTarget.value)
                }
                onBlur={field.handleBlur}
                error={errorFor('description')}
              />
            )}
          </form.Field>
        ) : null}
      </Stack>
    </form>
  )
}
