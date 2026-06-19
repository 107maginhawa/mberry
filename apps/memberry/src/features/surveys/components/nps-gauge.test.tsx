import { describe, test, expect } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { NpsGauge } from './nps-gauge'

describe('NpsGauge', () => {
  test('[AC-NG-001] renders score value', () => {
    renderWithProviders(<NpsGauge score={42} promoters={60} passives={20} detractors={20} />)
    expect(screen.getByText('+42')).toBeInTheDocument()
  })

  test('[AC-NG-002] negative score renders without plus sign', () => {
    renderWithProviders(<NpsGauge score={-10} promoters={10} passives={20} detractors={70} />)
    expect(screen.getByText('-10')).toBeInTheDocument()
  })

  test('[AC-NG-003] score < 0 shows "Needs Improvement" label', () => {
    renderWithProviders(<NpsGauge score={-5} promoters={10} passives={20} detractors={70} />)
    expect(screen.getByText('Needs Improvement')).toBeInTheDocument()
  })

  test('[AC-NG-004] score 0-30 shows "Good" label', () => {
    renderWithProviders(<NpsGauge score={20} promoters={40} passives={30} detractors={30} />)
    expect(screen.getByText('Good')).toBeInTheDocument()
  })

  test('[AC-NG-005] score 31-50 shows "Great" label', () => {
    renderWithProviders(<NpsGauge score={45} promoters={60} passives={25} detractors={15} />)
    expect(screen.getByText('Great')).toBeInTheDocument()
  })

  test('[AC-NG-006] score 51-70 shows "Excellent" label', () => {
    renderWithProviders(<NpsGauge score={60} promoters={70} passives={20} detractors={10} />)
    expect(screen.getByText('Excellent')).toBeInTheDocument()
  })

  test('[AC-NG-007] score > 70 shows "World-Class" label', () => {
    renderWithProviders(<NpsGauge score={80} promoters={90} passives={5} detractors={5} />)
    expect(screen.getByText('World-Class')).toBeInTheDocument()
  })

  test('[AC-NG-008] renders "NPS Score" heading', () => {
    renderWithProviders(<NpsGauge score={30} promoters={50} passives={30} detractors={20} />)
    expect(screen.getByText('NPS Score')).toBeInTheDocument()
  })
})
