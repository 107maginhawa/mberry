import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSurveyDraft } from './use-survey-draft'

// Mock IndexedDB — the hook uses it for draft persistence.
// We stub the global `indexedDB` with an in-memory store.

type StoredEntry = { surveyId: string; answers: Record<string, unknown>; updatedAt: number }
let inMemoryStore: Map<string, StoredEntry>

function makeIDBRequest<T>(result: T) {
  const req: any = {}
  req.result = result
  req.onsuccess = null
  req.onerror = null
  // Fire onsuccess after tick
  Promise.resolve().then(() => req.onsuccess?.())
  return req
}

function makeIDBErrorRequest(err: Error) {
  const req: any = {}
  req.result = undefined
  req.onsuccess = null
  req.onerror = null
  Promise.resolve().then(() => req.onerror?.({ target: { error: err } }))
  return req
}

function makeObjectStore() {
  return {
    get: (key: string) => makeIDBRequest(inMemoryStore.get(key) ?? undefined),
    put: (value: StoredEntry) => {
      inMemoryStore.set(value.surveyId, value)
      return makeIDBRequest(undefined)
    },
    delete: (key: string) => {
      inMemoryStore.delete(key)
      return makeIDBRequest(undefined)
    },
  }
}

function makeTx() {
  return { objectStore: () => makeObjectStore() }
}

function makeDB() {
  return {
    objectStoreNames: { contains: () => true },
    transaction: () => makeTx(),
    createObjectStore: vi.fn(),
  }
}

function makeOpenRequest(db: ReturnType<typeof makeDB>) {
  const req: any = {}
  req.result = db
  req.onsuccess = null
  req.onerror = null
  req.onupgradeneeded = null
  Promise.resolve().then(() => req.onsuccess?.())
  return req
}

beforeEach(() => {
  inMemoryStore = new Map()
  const db = makeDB()
  ;(globalThis as any).indexedDB = {
    open: () => makeOpenRequest(db),
  }
})

describe('useSurveyDraft', () => {
  test('[AC-USD-001] starts with no restored draft', async () => {
    const { result } = renderHook(() => useSurveyDraft({ surveyId: 'survey-1' }))
    await waitFor(() => {
      expect(result.current.hasRestoredDraft).toBe(false)
      expect(result.current.restoredAnswers).toBeNull()
    })
  })

  test('[AC-USD-002] restores a draft that was previously saved', async () => {
    // Seed the store with an existing draft
    inMemoryStore.set('survey-1', {
      surveyId: 'survey-1',
      answers: { q1: 'Hello world' },
      updatedAt: Date.now(),
    })

    const { result } = renderHook(() => useSurveyDraft({ surveyId: 'survey-1' }))
    await waitFor(() => {
      expect(result.current.hasRestoredDraft).toBe(true)
      expect(result.current.restoredAnswers).toEqual({ q1: 'Hello world' })
    })
  })

  test('[AC-USD-003] saveAnswers persists answers to the store (after debounce)', async () => {
    const { result } = renderHook(() => useSurveyDraft({ surveyId: 'survey-2' }))

    act(() => {
      result.current.saveAnswers({ q1: 'test answer' })
    })

    // Wait for the 500ms debounce + IDB async operations to complete
    await waitFor(
      () => {
        expect(inMemoryStore.has('survey-2')).toBe(true)
      },
      { timeout: 1500 },
    )

    const stored = inMemoryStore.get('survey-2')!
    expect(stored.answers).toEqual({ q1: 'test answer' })
  })

  test('[AC-USD-004] clearDraft resets hasRestoredDraft and restoredAnswers', async () => {
    inMemoryStore.set('survey-3', {
      surveyId: 'survey-3',
      answers: { q1: 'something' },
      updatedAt: Date.now(),
    })

    const { result } = renderHook(() => useSurveyDraft({ surveyId: 'survey-3' }))
    await waitFor(() => expect(result.current.hasRestoredDraft).toBe(true))

    act(() => {
      result.current.clearDraft()
    })

    expect(result.current.hasRestoredDraft).toBe(false)
    expect(result.current.restoredAnswers).toBeNull()
  })

  test('[AC-USD-005] when enabled=false, does not load or save draft', async () => {
    inMemoryStore.set('survey-off', {
      surveyId: 'survey-off',
      answers: { q1: 'should not load' },
      updatedAt: Date.now(),
    })

    const { result } = renderHook(() => useSurveyDraft({ surveyId: 'survey-off', enabled: false }))

    // Give time for async load that should NOT fire
    await new Promise((r) => setTimeout(r, 50))

    expect(result.current.hasRestoredDraft).toBe(false)
    expect(result.current.restoredAnswers).toBeNull()
  })

  test('[AC-USD-006] isSaved starts false', () => {
    const { result } = renderHook(() => useSurveyDraft({ surveyId: 'survey-4' }))
    expect(result.current.isSaved).toBe(false)
  })
})
