import {
  ActionIcon,
  Box,
  Button,
  Center,
  Group,
  SegmentedControl,
  TextInput,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core'
import {
  IconLayoutColumns,
  IconLayoutGrid,
  IconList,
  IconPlus,
} from '@tabler/icons-react'

import classes from './BooksToolbar.module.css'

import type { BoxProps } from '@mantine/core'
import type { ReactNode } from 'react'

/**
 * A control that is drawn but does not work yet.
 *
 * `Tooltip` needs its target to emit mouse events, and a disabled control emits
 * none - so the tooltip goes on a wrapper and the CSS takes the child out of hit
 * testing. Keeping the control genuinely `disabled` rather than faking it with
 * `data-disabled` is what keeps the keyboard and screen readers honest too.
 */
export function Soon({
  children,
  ...box
}: Readonly<BoxProps & { children: ReactNode }>) {
  return (
    <Tooltip label="Soon" withArrow>
      <Box className={classes.soon} {...box}>
        {children}
      </Box>
    </Tooltip>
  )
}

/**
 * Everything you can do to a shelf of books: search it, change how it is laid
 * out, add to it.
 *
 * Only "Add book" is wired - it opens the add-book wizard, which is a UI over a
 * stubbed search and saves nothing yet. The rest waits on a books endpoint, and
 * until then is disabled and says "Soon", the way an unbuilt destination in
 * `AppNav` does. Drawn now so the page has the shape it will keep, and so
 * wiring the rest later is a matter of handing these controls their state
 * rather than inventing a layout.
 *
 * Router-agnostic on purpose, so it can be exercised without one: the page
 * above decides where "Add book" goes.
 */
export function BooksToolbar({
  onAddBook,
}: Readonly<{ onAddBook: () => void }>) {
  return (
    <Group gap="sm">
      <Soon flex={1} miw={240}>
        <TextInput
          aria-label="Search books"
          placeholder={
            'Search… type:Manga, tag:read, contributor:endo, NOT, OR, "phrase"'
          }
          disabled
        />
      </Soon>

      <Soon>
        <Button variant="default" disabled>
          Search
        </Button>
      </Soon>

      <Soon>
        <SegmentedControl
          value="list"
          readOnly
          disabled
          data={[
            {
              value: 'list',
              label: (
                <ViewOption
                  icon={<IconList size={18} stroke={1.6} />}
                  name="List view"
                />
              ),
            },
            {
              value: 'grid',
              label: (
                <ViewOption
                  icon={<IconLayoutGrid size={18} stroke={1.6} />}
                  name="Grid view"
                />
              ),
            },
          ]}
        />
      </Soon>

      <Soon>
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Choose columns"
          disabled
        >
          <IconLayoutColumns size={18} stroke={1.6} />
        </ActionIcon>
      </Soon>

      <Soon>
        <Button variant="default" disabled>
          Import CSV
        </Button>
      </Soon>

      <Button leftSection={<IconPlus size={16} />} onClick={onAddBook}>
        Add book
      </Button>
    </Group>
  )
}

/**
 * An icon-only segment. The name is there but unseen: a radio whose label is a
 * picture has no accessible name otherwise.
 */
function ViewOption({
  icon,
  name,
}: Readonly<{ icon: ReactNode; name: string }>) {
  return (
    <Center>
      {icon}
      <VisuallyHidden>{name}</VisuallyHidden>
    </Center>
  )
}
