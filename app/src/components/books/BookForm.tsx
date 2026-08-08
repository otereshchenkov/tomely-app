import { useForm } from '@tanstack/react-form'
import {
  Accordion,
  Anchor,
  Button,
  Chip,
  CloseButton,
  Group,
  Input,
  MultiSelect,
  NumberInput,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import {
  IconBook,
  IconDeviceMobile,
  IconHeadphones,
  IconNotebook,
  IconPlus,
} from '@tabler/icons-react'
import { z } from 'zod'

import { BookCover } from '#/components/dashboard/BookRow'
import { Soon } from '#/components/books/BooksToolbar'
import { useFieldErrors } from '#/lib/form'
import {
  CONTRIBUTOR_ROLES,
  DEFAULT_CONTRIBUTOR_ROLE,
  EDITION_FORMATS,
  GENRES,
  LANGUAGES,
  MEDIA_TYPES,
  SHELVES,
} from '#/lib/books'

import classes from './BookForm.module.css'

import type { BookDraft, EditionFormat } from '#/lib/books'
import type { TablerIcon } from '@tabler/icons-react'

const FORMAT_ICONS: Record<EditionFormat, TablerIcon> = {
  Paperback: IconBook,
  Hardcover: IconNotebook,
  'E-Book': IconDeviceMobile,
  Audiobook: IconHeadphones,
}

/** Anything an ISBN may be written with, gone, so 978-0-441-01359-3 counts. */
function bare(value: string): string {
  return value.replace(/[\s-]/g, '')
}

/**
 * What the form itself can know is wrong, before anything has been sent.
 *
 * Inert until there is somewhere to save to - the button below is disabled, so
 * `onSubmit` never runs - but written now because these are the rules, and
 * because the API's own checks will want mirroring here the way
 * `NewLibraryModal`'s schema mirrors `src/routes/libraries.rs`. Nothing here
 * insists on more than a reader can supply: only the title is required, and an
 * ISBN is checked for shape only when one has been typed.
 */
const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(500, 'Use at most 500 characters'),
  subtitle: z.string().trim().max(500, 'Use at most 500 characters'),
  mediaType: z.string().min(1, 'Media type is required'),
  description: z.string().trim().max(10000, 'Use at most 10000 characters'),
  contributors: z.array(
    z.object({
      name: z.string().trim().max(200, 'Use at most 200 characters'),
      role: z.enum(CONTRIBUTOR_ROLES),
    }),
  ),
  tags: z.array(z.string()),
  genres: z.array(z.string()),
  shelves: z.array(z.string()),
  edition: z.object({
    format: z.enum(EDITION_FORMATS),
    name: z.string().trim().max(200, 'Use at most 200 characters'),
    publisher: z.string().trim().max(200, 'Use at most 200 characters'),
    publishDate: z.string(),
    language: z.string(),
    isbn13: z
      .string()
      .refine((v) => v === '' || /^\d{13}$/.test(bare(v)), 'Use 13 digits'),
    isbn10: z
      .string()
      .refine(
        (v) => v === '' || /^\d{9}[\dX]$/i.test(bare(v)),
        'Use 10 characters, digits or a trailing X',
      ),
    // `NumberInput` hands back a number once it parses and the raw string until
    // then, so both are legal here and '' is "not said".
    pageCount: z.union([
      z.literal(''),
      z.number().int().positive('Use a whole number of pages'),
      z.string().regex(/^[1-9]\d*$/, 'Use a whole number of pages'),
    ]),
  }),
})

/**
 * Split out so the sections below can be typed against it: `useForm` is
 * generic, and `ReturnType` cannot reach through a generic function - but it
 * can reach through this one.
 */
function useBookForm(initial: BookDraft) {
  return useForm({
    defaultValues: initial,
    validators: { onSubmit: schema },
    // Nothing to save to yet. The button is disabled and says so; this is the
    // hook the books endpoint lands on.
    onSubmit: () => {},
  })
}

type BookFormApi = ReturnType<typeof useBookForm>
type ErrorFor = (name: string) => string | undefined

/**
 * The second step of adding a book, and the whole of adding one by hand.
 *
 * Router-free like every other form here, so it can be exercised without one -
 * the route above decides where Cancel goes and hands the draft in.
 *
 * The caller must not mount this until `initial` has settled. `useForm` reads
 * `defaultValues` on the first render only, so a form mounted while the picked
 * search result is still being resolved keeps the empty draft for good, with
 * nothing anywhere to say why. `LibraryDetailsForm` carries the same warning
 * and the routes gate on it the same way.
 */
export function BookForm({
  initial,
  coverUrl = null,
  onCancel,
}: Readonly<{
  initial: BookDraft
  /** The cover of the search result this was filled in from. Shown, not
   *  edited - uploading one is a later job. */
  coverUrl?: string | null
  onCancel: () => void
}>) {
  const form = useBookForm(initial)
  const errorFor = useFieldErrors(form)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <Stack gap="lg">
        <Group align="flex-start" gap="md" wrap="nowrap">
          {coverUrl ? (
            <BookCover
              book={{
                id: 'draft',
                title: initial.title,
                authors: [],
                coverUrl,
              }}
              w={72}
              h={104}
            />
          ) : null}

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" flex={1}>
            <form.Field name="title">
              {(field) => (
                <TextInput
                  label="Title"
                  withAsterisk
                  data-autofocus
                  value={field.state.value}
                  onChange={(event) =>
                    field.handleChange(event.currentTarget.value)
                  }
                  onBlur={field.handleBlur}
                  error={errorFor('title')}
                />
              )}
            </form.Field>

            <form.Field name="subtitle">
              {(field) => (
                <TextInput
                  label="Subtitle"
                  placeholder="e.g. Vol. 15"
                  value={field.state.value}
                  onChange={(event) =>
                    field.handleChange(event.currentTarget.value)
                  }
                  onBlur={field.handleBlur}
                  error={errorFor('subtitle')}
                />
              )}
            </form.Field>
          </SimpleGrid>
        </Group>

        <form.Field name="mediaType">
          {(field) => (
            <Select
              label="Media type"
              withAsterisk
              data={[...MEDIA_TYPES]}
              allowDeselect={false}
              maw={320}
              value={field.state.value}
              onChange={(value) => field.handleChange(value ?? '')}
              onBlur={field.handleBlur}
              error={errorFor('mediaType')}
            />
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => (
            <Textarea
              label="Description"
              autosize
              minRows={4}
              maxRows={12}
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(event.currentTarget.value)
              }
              onBlur={field.handleBlur}
              error={errorFor('description')}
            />
          )}
        </form.Field>

        <Contributors form={form} errorFor={errorFor} />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <form.Field name="tags">
            {(field) => (
              <TagsInput
                label="Tags"
                description="Anything you like - press Enter to add one"
                placeholder="Search or create tags…"
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={errorFor('tags')}
              />
            )}
          </form.Field>

          <form.Field name="genres">
            {(field) => (
              <MultiSelect
                label="Genres"
                placeholder={
                  field.state.value.length > 0 ? undefined : 'Search genres…'
                }
                data={[...GENRES]}
                searchable
                clearable
                hidePickedOptions
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={errorFor('genres')}
              />
            )}
          </form.Field>
        </SimpleGrid>

        <form.Field name="shelves">
          {(field) => (
            <Input.Wrapper label="Shelves">
              <Chip.Group
                multiple
                value={field.state.value}
                onChange={field.handleChange}
              >
                <Group gap="xs" mt={6}>
                  {SHELVES.map((shelf) => (
                    <Chip
                      key={shelf.value}
                      value={shelf.value}
                      variant="outline"
                    >
                      {shelf.label}
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>
            </Input.Wrapper>
          )}
        </form.Field>

        <Edition form={form} errorFor={errorFor} />

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          {/* There is no books endpoint yet. Disabled and marked, the way every
              unbuilt control on this page is - see `Soon`. */}
          <Soon>
            <Button type="submit" disabled>
              Save book
            </Button>
          </Soon>
        </Group>
      </Stack>
    </form>
  )
}

/**
 * Who made the book, and what they did.
 *
 * A list rather than an "author" field: a manga has an artist, a translation
 * has a translator, and an audiobook has a narrator, and flattening all of them
 * into one line is how that information stops being searchable.
 */
function Contributors({
  form,
  errorFor,
}: Readonly<{ form: BookFormApi; errorFor: ErrorFor }>) {
  return (
    <form.Field name="contributors" mode="array">
      {(field) => (
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Input.Label>Contributors</Input.Label>
            <Anchor
              component="button"
              type="button"
              fz="sm"
              onClick={() =>
                field.pushValue({ name: '', role: DEFAULT_CONTRIBUTOR_ROLE })
              }
            >
              <Group gap={4} component="span">
                <IconPlus size={14} />
                Add
              </Group>
            </Anchor>
          </Group>

          {field.state.value.length === 0 ? (
            <Text fz="sm" c="dimmed">
              Nobody yet.
            </Text>
          ) : null}

          {field.state.value.map((_, index) => (
            <Group key={index} gap="xs" align="flex-start" wrap="nowrap">
              <form.Field name={`contributors[${index}].name`}>
                {(nameField) => (
                  <TextInput
                    aria-label={`Contributor ${index + 1} name`}
                    placeholder="Name"
                    flex={1}
                    value={nameField.state.value}
                    onChange={(event) =>
                      nameField.handleChange(event.currentTarget.value)
                    }
                    onBlur={nameField.handleBlur}
                    error={errorFor(`contributors[${index}].name`)}
                  />
                )}
              </form.Field>

              <form.Field name={`contributors[${index}].role`}>
                {(roleField) => (
                  <Select
                    aria-label={`Contributor ${index + 1} role`}
                    data={[...CONTRIBUTOR_ROLES]}
                    allowDeselect={false}
                    w={160}
                    value={roleField.state.value}
                    // `Select` answers null when nothing is chosen, which
                    // `allowDeselect={false}` means cannot happen here.
                    onChange={(value) =>
                      roleField.handleChange(value ?? DEFAULT_CONTRIBUTOR_ROLE)
                    }
                    onBlur={roleField.handleBlur}
                  />
                )}
              </form.Field>

              <CloseButton
                aria-label={`Remove contributor ${index + 1}`}
                mt={4}
                onClick={() => field.removeValue(index)}
              />
            </Group>
          ))}
        </Stack>
      )}
    </form.Field>
  )
}

/**
 * The copy, as opposed to the work: which printing this is, who printed it and
 * what its barcode says.
 *
 * Folded into an accordion because most of it is optional and a reader adding a
 * book by hand rarely has any of it - but it arrives filled in from a search
 * result, so the panel starts open rather than hiding what was just fetched.
 */
function Edition({
  form,
  errorFor,
}: Readonly<{ form: BookFormApi; errorFor: ErrorFor }>) {
  return (
    <Accordion
      variant="default"
      defaultValue="edition"
      className={classes.edition}
    >
      <Accordion.Item value="edition" style={{ borderBottom: 'none' }}>
        <Accordion.Control>Edition details</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <form.Field name="edition.format">
              {(field) => (
                <Radio.Group
                  aria-label="Format"
                  value={field.state.value}
                  onChange={field.handleChange}
                >
                  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                    {EDITION_FORMATS.map((format) => {
                      const Icon = FORMAT_ICONS[format]
                      return (
                        <Radio.Card
                          key={format}
                          value={format}
                          p="md"
                          radius="md"
                          className={classes.format}
                        >
                          <Stack align="center" gap={6}>
                            <Icon size={22} stroke={1.6} />
                            <Text
                              fz="sm"
                              className={classes.formatLabel}
                              ta="center"
                            >
                              {format}
                            </Text>
                          </Stack>
                        </Radio.Card>
                      )
                    })}
                  </SimpleGrid>
                </Radio.Group>
              )}
            </form.Field>

            <form.Field name="edition.name">
              {(field) => (
                <TextInput
                  label="Edition name"
                  placeholder="e.g. 1st Edition"
                  value={field.state.value}
                  onChange={(event) =>
                    field.handleChange(event.currentTarget.value)
                  }
                  onBlur={field.handleBlur}
                  error={errorFor('edition.name')}
                />
              )}
            </form.Field>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <form.Field name="edition.publisher">
                {(field) => (
                  <TextInput
                    label="Publisher"
                    value={field.state.value}
                    onChange={(event) =>
                      field.handleChange(event.currentTarget.value)
                    }
                    onBlur={field.handleBlur}
                    error={errorFor('edition.publisher')}
                  />
                )}
              </form.Field>

              <form.Field name="edition.publishDate">
                {(field) => (
                  <TextInput
                    label="Publish date"
                    type="date"
                    value={field.state.value}
                    onChange={(event) =>
                      field.handleChange(event.currentTarget.value)
                    }
                    onBlur={field.handleBlur}
                    error={errorFor('edition.publishDate')}
                  />
                )}
              </form.Field>
            </SimpleGrid>

            <form.Field name="edition.language">
              {(field) => (
                <Select
                  label="Language"
                  placeholder="— select —"
                  data={LANGUAGES.map((language) => ({ ...language }))}
                  searchable
                  clearable
                  maw={320}
                  value={field.state.value || null}
                  onChange={(value) => field.handleChange(value ?? '')}
                  onBlur={field.handleBlur}
                  error={errorFor('edition.language')}
                />
              )}
            </form.Field>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <form.Field name="edition.isbn13">
                {(field) => (
                  <TextInput
                    label="ISBN-13"
                    inputMode="numeric"
                    value={field.state.value}
                    onChange={(event) =>
                      field.handleChange(event.currentTarget.value)
                    }
                    onBlur={field.handleBlur}
                    error={errorFor('edition.isbn13')}
                  />
                )}
              </form.Field>

              <form.Field name="edition.isbn10">
                {(field) => (
                  <TextInput
                    label="ISBN-10"
                    value={field.state.value}
                    onChange={(event) =>
                      field.handleChange(event.currentTarget.value)
                    }
                    onBlur={field.handleBlur}
                    error={errorFor('edition.isbn10')}
                  />
                )}
              </form.Field>
            </SimpleGrid>

            <form.Field name="edition.pageCount">
              {(field) => (
                <NumberInput
                  label="Page count"
                  min={1}
                  allowNegative={false}
                  allowDecimal={false}
                  maw={320}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  error={errorFor('edition.pageCount')}
                />
              )}
            </form.Field>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  )
}
