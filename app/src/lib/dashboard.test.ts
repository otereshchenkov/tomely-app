import { describe, expect, it } from 'vitest'

import { emptyDashboard, lastTwelveMonths, monthLabel } from './dashboard'

describe('lastTwelveMonths', () => {
  it('ends with the month it is given and reaches eleven months back', () => {
    const months = lastTwelveMonths(new Date(2026, 7, 7))

    expect(months).toHaveLength(12)
    expect(months[0].month).toBe('2025-09')
    expect(months[11].month).toBe('2026-08')
  })

  it('crosses the year boundary in January', () => {
    const months = lastTwelveMonths(new Date(2026, 0, 31))

    expect(months[0].month).toBe('2025-02')
    expect(months[11].month).toBe('2026-01')
  })

  it('starts every bucket empty', () => {
    const months = lastTwelveMonths(new Date(2026, 7, 7))

    expect(months.every((month) => month.finished === 0)).toBe(true)
  })
})

describe('monthLabel', () => {
  it('names the month rather than the one before it', () => {
    expect(monthLabel('2026-01', 'en-GB')).toBe('Jan')
    expect(monthLabel('2026-12', 'en-GB')).toBe('Dec')
  })
})

describe('emptyDashboard', () => {
  it('has a chart but nothing in it', () => {
    const dashboard = emptyDashboard(new Date(2026, 7, 7))

    expect(dashboard.finishedByMonth).toHaveLength(12)
    expect(dashboard.finishedThisYear).toBe(0)
    expect(dashboard.currentlyReading).toEqual([])
    expect(dashboard.stats.totalBooks).toBe(0)
  })
})
