import { describe, test, expect } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { NpsGauge } from './nps-gauge'

// NpsGauge is purely presentational — no mocks needed

const makeProps = (overrides: Partial<{
  score: number
  promoters: number
  passives: number
  detractors: number
}> = {}) => ({
  score: overrides.score ?? 45,
  promoters: overrides.promoters ?? 60,
  passives: overrides.passives ?? 20,
  detractors: overrides.detractors ?? 20,
})

describe('NpsGauge', () => {
  test('[AC-NG-001] renders score with "NPS Score" label', () => {
    renderWithProviders(<NpsGauge {...makeProps({ score: 45 })} />)
    expect(screen.getByText('NPS Score')).toBeInTheDocument()
    expect(screen.getByText('+45')).toBeInTheDocument()
  })

  test('[AC-NG-002] negative score renders without plus sign', () => {
    renderWithProviders(<NpsGauge {...makeProps({ score: -10 })} />)
    expect(screen.getByText('-10')).toBeInTheDocument()
  })

  test('[AC-NG-003] score < 0 shows "Needs Improvement" label', () => {
    renderWithProviders(<NpsGauge {...makeProps({ score: -5 })} />)
    expect(screen.getByText('Needs Improvement')).toBeInTheDocument()
  })

  test('[AC-NG-004] score 0-30 shows "Good" label', () => {
    renderWithProviders(<NpsGauge {...makeProps({ score: 20 })} />)
    expect(screen.getByText('Good')).toBeInTheDocument()
  })

  test('[AC-NG-005] score 31-50 shows "Great" label', () => {
    renderWithProviders(<NpsGauge {...makeProps({ score: 40 })} />)
    expect(screen.getByText('Great')).toBeInTheDocument()
  })

  test('[AC-NG-006] score 51-70 shows "Excellent" label', () => {
    renderWithProviders(<NpsGauge {...makeProps({ score: 60 })} />)
    expect(screen.getByText('Excellent')).toBeInTheDocument()
  })

  test('[AC-NG-007] score > 70 shows "World-Class" label', () => {
    renderWithProviders(<NpsGauge {...makeProps({ score: 75 })} />)
    expect(screen.getByText('World-Class')).toBeInTheDocument()
  })

  test('[AC-NG-008] renders promoter/passive/detractor counts', () => {
    renderWithProviders(<NpsGauge score={30} promoters={50} passives={30} detractors={20} />)
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  test('[AC-NG-009] shows "No responses yet" when all counts are zero', () => {
    renderWithProviders(<NpsGauge score={0} promoters={0} passives={0} detractors={0} />)
    expect(screen.getByText('No responses yet')).toBeInTheDocument()
  })

  test('[AC-NG-010] renders "Detractors", "Passives", "Promoters" legend labels', () => {
    renderWithProviders(<NpsGauge score={45} promoters={60} passives={20} detractors={20} />)
    expect(screen.getByText(/Detractors/)).toBeInTheDocument()
    expect(screen.getByText(/Passives/)).toBeInTheDocument()
    expect(screen.getByText(/Promoters/)).toBeInTheDocument()
  })
})
