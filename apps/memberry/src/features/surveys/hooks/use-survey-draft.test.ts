import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { renderHook, act } from '@testing-library/react'
import { useSurveyDraft } from './use-survey-draft'

// IndexedDB is not available in jsdom — polyfill it with a minimal in-memory stub
const idbStore = new Map<string, any>()

function makeFakeDB() {
  return {
    transaction: (_name: string, _mode: string) => ({
      objectStore: () => ({
        get: (key: string) => {
          const req: any = {}
          const result = idbStore.get(key) ?? null
          setTimeout(() => {
            req.result = result
            req.onsuccess?.()
          }, 0)
          return req
        },
        put: (entry: any) => {
          idbStore.set(entry.surveyId, entry)
          const req: any = {}
          setTimeout(() => {
            req.onsuccess?.()
          }, 0)
          return req
        },
        delete: (key: string) => {
          idbStore.delete(key)
          const req: any = {}
          setTimeout(() => {
            req.onsuccess?.()
          }, 0)
          return req
        },
      }),
    }),
    objectStoreNames: { contains: () => true },
    createObjectStore: vi.fn(),
  }
}

;(global as any).indexedDB = {
  open: (_name: string, _version: number) => {
    const req: any = {}
    setTimeout(() => {
      const db = makeFakeDB()
      req.result = db
      req.onsuccess?.({ target: { result: db } })
    }, 0)
    return req
  },
}

describe('useSurveyDraft', () => {
  beforeEach(() => {
    idbStore.clear()
    vi.clearAllMocks()
  })

  test('[AC-UD-001] returns expected API shape', () => {
    const { result } = renderHook(() =>
      useSurveyDraft({ surveyId: 'survey-1', enabled: true })
    )
    expect(result.current).toHaveProperty('restoredAnswers')
    expect(result.current).toHaveProperty('hasRestoredDraft')
    expect(result.current).toHaveProperty('saveAnswers')
    expect(result.current).toHaveProperty('clearDraft')
    expect(result.current).toHaveProperty('isSaved')
  })

  test('[AC-UD-002] initially has no restored answers', () => {
    const { result } = renderHook(() =>
      useSurveyDraft({ surveyId: 'survey-2', enabled: true })
    )
    expect(result.current.restoredAnswers).toBeNull()
    expect(result.current.hasRestoredDraft).toBe(false)
  })

  test('[AC-UD-003] saveAnswers is callable without throwing', () => {
    const { result } = renderHook(() =>
      useSurveyDraft({ surveyId: 'survey-3', enabled: true })
    )
    expect(() => {
      act(() => {
        result.current.saveAnswers({ q1: 'hello', q2: 42 })
      })
    }).not.toThrow()
  })

  test('[AC-UD-004] clearDraft is callable without throwing', () => {
    const { result } = renderHook(() =>
      useSurveyDraft({ surveyId: 'survey-4', enabled: true })
    )
    expect(() => {
      act(() => {
        result.current.clearDraft()
      })
    }).not.toThrow()
  })

  test('[AC-UD-005] isSaved starts as false', () => {
    const { result } = renderHook(() =>
      useSurveyDraft({ surveyId: 'survey-5', enabled: true })
    )
    expect(result.current.isSaved).toBe(false)
  })
})
