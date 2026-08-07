import { Card, Text, Tooltip } from '@mantine/core'
import clsx from 'clsx'

import { monthLabel } from '#/lib/dashboard'

import classes from './YearInBooksCard.module.css'

import type { MonthlyCount } from '#/lib/dashboard'

/** How many books this year, and the shape of the twelve months behind it. */
export function YearInBooksCard({
  year,
  finished,
  months,
}: Readonly<{
  year: number
  finished: number
  months: MonthlyCount[]
}>) {
  return (
    <Card withBorder radius="md" padding="lg">
      <Text tt="uppercase" fz="xs" fw={700} c="dimmed">
        Read in {year}
      </Text>
      <Text fz={36} fw={700} lh={1.2}>
        {finished}
      </Text>

      <MonthlyBars months={months} />

      <Text tt="uppercase" fz="xs" c="dimmed" mt={6}>
        Last 12 months
      </Text>
    </Card>
  )
}

function MonthlyBars({ months }: Readonly<{ months: MonthlyCount[] }>) {
  const max = Math.max(...months.map((month) => month.finished), 0)

  return (
    <div
      className={classes.bars}
      role="img"
      // The bars themselves are hover affordances; the whole reading has to be
      // available as text for anyone who is not using a pointer.
      aria-label={`Books finished each month: ${months
        .map((month) => `${monthLabel(month.month)} ${month.finished}`)
        .join(', ')}`}
    >
      {months.map((month) => (
        <Tooltip
          key={month.month}
          withArrow
          label={`${monthLabel(month.month)}: ${month.finished}`}
        >
          <div
            className={clsx(classes.bar, month.finished === 0 && classes.empty)}
            style={{
              height: max > 0 ? `${(month.finished / max) * 100}%` : 0,
            }}
          />
        </Tooltip>
      ))}
    </div>
  )
}
