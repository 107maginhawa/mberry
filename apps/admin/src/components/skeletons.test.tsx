import { describe, test, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { CardSkeleton, TableSkeleton, StatCardSkeleton } from './skeletons'

describe('CardSkeleton', () => {
  test('renders skeleton bones', () => {
    const { container } = render(<CardSkeleton />)
    const bones = container.querySelectorAll('.animate-pulse')
    expect(bones.length).toBeGreaterThan(0)
  })

  test('renders with card border styling', () => {
    const { container } = render(<CardSkeleton />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('rounded-lg')
    expect(card.className).toContain('border')
    expect(card.className).toContain('bg-card')
  })
})

describe('TableSkeleton', () => {
  test('renders default 5 rows with 4 columns', () => {
    const { container } = render(
      <table>
        <tbody>
          <TableSkeleton />
        </tbody>
      </table>,
    )
    const rows = container.querySelectorAll('tr')
    expect(rows.length).toBe(5)
    // Each row should have 4 cells
    const firstRow = rows[0]!
    expect(firstRow.querySelectorAll('td').length).toBe(4)
  })

  test('renders custom number of rows and columns', () => {
    const { container } = render(
      <table>
        <tbody>
          <TableSkeleton rows={3} cols={6} />
        </tbody>
      </table>,
    )
    const rows = container.querySelectorAll('tr')
    expect(rows.length).toBe(3)
    const firstRow = rows[0]!
    expect(firstRow.querySelectorAll('td').length).toBe(6)
  })

  test('each cell contains an animated bone', () => {
    const { container } = render(
      <table>
        <tbody>
          <TableSkeleton rows={1} cols={2} />
        </tbody>
      </table>,
    )
    const bones = container.querySelectorAll('.animate-pulse')
    expect(bones.length).toBe(2)
  })
})

describe('StatCardSkeleton', () => {
  test('renders skeleton with card styling', () => {
    const { container } = render(<StatCardSkeleton />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('rounded-lg')
    expect(card.className).toContain('border')
    expect(card.className).toContain('bg-card')
  })

  test('renders animated bones', () => {
    const { container } = render(<StatCardSkeleton />)
    const bones = container.querySelectorAll('.animate-pulse')
    expect(bones.length).toBeGreaterThan(0)
  })
})
