import { describe, test, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { CollectionRateCard } from './collection-rate-card'

describe('CollectionRateCard', () => {
  // AC-T5-002: renders collection rate percentage
  test('[AC-T5-002] renders collection rate percentage', () => {
    render(<CollectionRateCard currentRate={85} previousRate={72} />)
    expect(screen.getByText('85%')).toBeDefined()
  })

  // AC-T5-002: shows up trend when rate increased
  test('[AC-T5-002] shows up trend indicator when rate increased', () => {
    render(<CollectionRateCard currentRate={85} previousRate={72} />)
    expect(screen.getByLabelText('Up 13 points')).toBeDefined()
  })

  // BR-T5-002: shows down trend when rate decreased
  test('[BR-T5-002] shows down trend when rate decreased', () => {
    render(<CollectionRateCard currentRate={60} previousRate={72} />)
    expect(screen.getByLabelText('Down 12 points')).toBeDefined()
  })

  // shows flat when no change
  test('shows flat indicator when no change', () => {
    render(<CollectionRateCard currentRate={50} previousRate={50} />)
    expect(screen.getByLabelText('No change')).toBeDefined()
  })

  // AC-T5-008: ARIA label for screen reader
  test('[AC-T5-008] has ARIA label for screen reader accessibility', () => {
    render(<CollectionRateCard currentRate={85} previousRate={72} />)
    expect(screen.getByLabelText('Collection rate 85 percent')).toBeDefined()
  })

  // AC-T5-007: handles zero rate gracefully
  test('[AC-T5-007] handles zero rate without crashing', () => {
    render(<CollectionRateCard currentRate={0} previousRate={0} />)
    expect(screen.getByText('0%')).toBeDefined()
  })
})
