import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventsList } from './EventsList'

const ev = (over: Partial<any> = {}) => ({ id: 'd1', title: 'Spring Assembly', status: 'draft', startDate: '2026-03-01T06:00:00Z', ...over })

describe('EventsList', () => {
  it('shows Publish only on draft rows, with a labeled button', () => {
    render(<EventsList status="ready" publishingId={null} onPublish={() => {}}
      events={[ev(), ev({ id: 'p1', title: 'Gala', status: 'published' })]} />)
    expect(screen.getByRole('button', { name: /publish spring assembly/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /publish gala/i })).not.toBeInTheDocument()
    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('disables every Publish button while any publish is in flight', () => {
    render(<EventsList status="ready" publishingId="d1" onPublish={() => {}}
      events={[ev(), ev({ id: 'd2', title: 'Second Draft' })]} />)
    expect(screen.getByRole('button', { name: /publish spring assembly/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /publish second draft/i })).toBeDisabled()
  })

  it('does not render an ISO date string', () => {
    render(<EventsList status="ready" publishingId={null} onPublish={() => {}} events={[ev()]} />)
    expect(screen.queryByText(/2026-03-01T06:00:00Z/)).not.toBeInTheDocument()
  })

  it('Publish opens a confirm; onPublish fires only after confirming', () => {
    const onPublish = vi.fn()
    render(<EventsList status="ready" publishingId={null} onPublish={onPublish} events={[ev()]} />)
    fireEvent.click(screen.getByRole('button', { name: /publish spring assembly/i }))
    expect(onPublish).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))
    expect(onPublish).toHaveBeenCalledWith('d1')
  })

  it('renders loading, error, and empty states', () => {
    const { rerender } = render(<EventsList status="loading" publishingId={null} onPublish={() => {}} events={[]} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    rerender(<EventsList status="error" publishingId={null} onPublish={() => {}} events={[]} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(<EventsList status="empty" publishingId={null} onPublish={() => {}} events={[]} />)
    expect(screen.getByText(/no events yet/i)).toBeInTheDocument()
  })
})
