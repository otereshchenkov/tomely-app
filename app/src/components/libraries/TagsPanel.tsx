import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconBan,
  IconCheck,
  IconPencil,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { z } from 'zod'

import { ApiError } from '#/lib/api'
import { useFieldErrors } from '#/lib/form'
import { TAG_COLORS, swatch } from '#/lib/tags'
import { DeleteTagModal } from './DeleteTagModal'

import classes from './TagsPanel.module.css'

import type { Tag, TagDraft } from '#/lib/tags'

// Mirrors the API's own checks in src/routes/tags.rs, the way `CataloguePanel`'s
// schema mirrors `catalogue.rs`. Duplicated on purpose: this one is for a fast
// answer on submit, that one is the rule.
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(60, 'Use at most 60 characters'),
  color: z.enum(TAG_COLORS).nullable(),
})

/**
 * What went wrong, said in words a reader can act on.
 *
 * The 409 is the interesting one, and it is the only conflict any of these
 * endpoints can produce: `From<DbErr>` turns m0007's unique index into a
 * conflict carrying Postgres' own message, constraint name and all. Unlike the
 * catalogue's delete, this resource has no usage guard to also answer 409, so a
 * duplicate name is the whole of it.
 */
function readable(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return 'That tag already exists.'
  }
  if (error instanceof ApiError) return error.message

  return 'Something went wrong. Please try again.'
}

/**
 * One library's tags: add to them, rename them, recolour them, remove them.
 *
 * Router-free and fetch-free like `CataloguePanel` and `BookForm`: the page
 * above owns the queries and the cache, this owns the interaction.
 *
 * A separate component rather than `CataloguePanel` with a colour bolted on. The
 * two lists look alike and mean different things - a catalogue entry carries a
 * description and a count of what is filed under it, a tag carries a colour and
 * refuses neither - and the shared version would be a component asking which of
 * three pages it was on.
 */
export function TagsPanel({
  tags,
  readOnly = false,
  onCreate,
  onUpdate,
  onDelete,
}: Readonly<{
  tags: Array<Tag>
  /** A member who is not an owner or an editor: the list is theirs to read and
   *  nothing on it is theirs to press. */
  readOnly?: boolean
  onCreate: (draft: TagDraft) => Promise<void>
  onUpdate: (id: string, draft: TagDraft) => Promise<void>
  onDelete: (tag: Tag) => Promise<void>
}>) {
  // At most one row is being edited at a time: two half-finished renames on
  // screen is a state nobody asked for and every one of them has to be resolved.
  const [editing, setEditing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Tag | null>(null)

  return (
    <>
      <Card
        withBorder
        radius="md"
        padding={0}
        className={classes.panel}
        maw={600}
      >
        {readOnly ? null : <AddTagForm onCreate={onCreate} />}

        {tags.length === 0 ? (
          <Text fz="sm" c="dimmed" p="md">
            {readOnly
              ? 'This library has no tags yet.'
              : 'Nothing here yet. Add the first one above.'}
          </Text>
        ) : null}

        {tags.map((tag) =>
          editing === tag.id ? (
            <EditTagRow
              key={tag.id}
              tag={tag}
              onCancel={() => setEditing(null)}
              onSave={async (draft) => {
                await onUpdate(tag.id, draft)
                setEditing(null)
              }}
            />
          ) : (
            <TagRow
              key={tag.id}
              tag={tag}
              readOnly={readOnly}
              onEdit={() => setEditing(tag.id)}
              onDelete={() => setDeleting(tag)}
            />
          ),
        )}
      </Card>

      {deleting ? (
        <DeleteTagModal
          tag={deleting}
          opened
          onClose={() => setDeleting(null)}
          onConfirm={onDelete}
        />
      ) : null}
    </>
  )
}

/**
 * The palette, as a row of swatches.
 *
 * A `radiogroup` rather than a `Select` of colour names: the whole point of a
 * colour is that it is quicker to recognise than to read, and fourteen of them
 * fit on one line. The leading ⊘ is "no colour" - a choice on the row rather
 * than an empty option hidden in a menu.
 *
 * `label` names the group rather than being decoration: editing a row puts a
 * second palette on screen beside the add form's, and two groups both called
 * "Tag colour" leave a screen reader with no way to say which is which.
 */
function ColorChoice({
  label,
  value,
  onChange,
}: Readonly<{
  label: string
  value: string | null
  onChange: (color: string | null) => void
}>) {
  return (
    <Group gap={6} role="radiogroup" aria-label={label}>
      <Tooltip label="No colour" withArrow>
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          aria-label="No colour"
          className={`${classes.swatch} ${classes.swatchNone} ${
            value === null ? classes.swatchChosen : ''
          }`}
          onClick={() => onChange(null)}
        >
          <IconBan size={13} />
        </button>
      </Tooltip>

      {TAG_COLORS.map((color) => (
        <Tooltip key={color} label={color} withArrow>
          <button
            type="button"
            role="radio"
            aria-checked={value === color}
            aria-label={color}
            className={`${classes.swatch} ${
              value === color ? classes.swatchChosen : ''
            }`}
            style={{ '--swatch-color': swatch(color) } as React.CSSProperties}
            onClick={() => onChange(color)}
          />
        </Tooltip>
      ))}
    </Group>
  )
}

/** The coloured dot in front of a tag's name, hollow when it has no colour. */
function TagDot({ color }: Readonly<{ color: string | null }>) {
  return (
    <span
      aria-hidden
      className={`${classes.dot} ${color === null ? classes.dotNone : ''}`}
      style={
        color === null
          ? undefined
          : ({ '--swatch-color': swatch(color) } as React.CSSProperties)
      }
    />
  )
}

/**
 * The add row at the top of the card.
 *
 * Its own form rather than a modal, for the reason `CataloguePanel` gives:
 * tagging a shelf is something a reader does several times in a row, and a
 * dialog that has to be reopened between each one turns a minute of typing into
 * a minute of clicking.
 */
function AddTagForm({
  onCreate,
}: Readonly<{ onCreate: (draft: TagDraft) => Promise<void> }>) {
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { name: '', color: null as string | null },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      try {
        await onCreate({ name: value.name, color: value.color })
        form.reset()
      } catch (error) {
        setSubmitError(readable(error))
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
                aria-label="New tag name"
                placeholder="New tag name…"
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

        <form.Field name="color">
          {(field) => (
            <ColorChoice
              label="New tag colour"
              value={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
      </Stack>
    </form>
  )
}

/** A tag at rest: its colour, what it is called, and what may be done to it. */
function TagRow({
  tag,
  readOnly,
  onEdit,
  onDelete,
}: Readonly<{
  tag: Tag
  readOnly: boolean
  onEdit: () => void
  onDelete: () => void
}>) {
  return (
    <Group
      className={classes.row}
      justify="space-between"
      align="center"
      wrap="nowrap"
      gap="sm"
    >
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
        <TagDot color={tag.color} />
        <Text fz="sm" fw={500} lineClamp={1}>
          {tag.name}
        </Text>
      </Group>

      {readOnly ? null : (
        <Group gap={4} wrap="nowrap" className={classes.actions}>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Edit ${tag.name}`}
            onClick={onEdit}
          >
            <IconPencil size={16} />
          </ActionIcon>

          {/* No disabled state and no tooltip explaining one, unlike the
              catalogue's rows: a tag is never in use in a way that refuses
              this. Deleting it is what takes it off things. */}
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Delete ${tag.name}`}
            onClick={onDelete}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      )}
    </Group>
  )
}

/**
 * The same row, being changed.
 *
 * Inline rather than a dialog: a tag is one word and one colour, and the row it
 * belongs to is the context that makes it obvious which one is being changed.
 */
function EditTagRow({
  tag,
  onSave,
  onCancel,
}: Readonly<{
  tag: Tag
  onSave: (draft: TagDraft) => Promise<void>
  onCancel: () => void
}>) {
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Mounted only once the row it edits is known, so `defaultValues` - which
  // `useForm` reads on the first render only - is the tag's own name and colour.
  const form = useForm({
    defaultValues: { name: tag.name, color: tag.color },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      try {
        await onSave({ name: value.name, color: value.color })
      } catch (error) {
        setSubmitError(readable(error))
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
      // Escape gets out of an edit the way it gets out of a dialog.
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
                aria-label={`${tag.name} name`}
                placeholder="Tag name…"
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
                  aria-label={`Save ${tag.name}`}
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
              aria-label={`Cancel editing ${tag.name}`}
              onClick={onCancel}
            >
              <IconX size={16} />
            </ActionIcon>
          </Group>
        </Group>

        <form.Field name="color">
          {(field) => (
            <ColorChoice
              label={`${tag.name} colour`}
              value={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
      </Stack>
    </form>
  )
}
