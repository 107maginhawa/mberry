import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * IndexedDB-backed draft persistence for survey responses.
 * Auto-saves answers per question as the member progresses.
 * Resumes on reconnection or page reload.
 */

const DB_NAME = 'memberry-survey-drafts'
const STORE_NAME = 'drafts'
const DB_VERSION = 1

interface DraftEntry {
  surveyId: string
  answers: Record<string, unknown>
  updatedAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'surveyId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function loadDraft(surveyId: string): Promise<DraftEntry | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(surveyId)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return null
  }
}

async function saveDraft(entry: DraftEntry): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(entry)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch {
    // Silently fail — draft is a nice-to-have
  }
}

async function deleteDraft(surveyId: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(surveyId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch {
    // Silently fail
  }
}

interface UseSurveyDraftOptions {
  surveyId: string
  enabled?: boolean
}

interface UseSurveyDraftReturn {
  /** Restored answers from IndexedDB (null if no draft) */
  restoredAnswers: Record<string, unknown> | null
  /** Whether a draft was found and restored */
  hasRestoredDraft: boolean
  /** Save current answers to draft */
  saveAnswers: (answers: Record<string, unknown>) => void
  /** Clear the draft (call after successful submission) */
  clearDraft: () => void
  /** Whether draft was recently saved (for UI indicator) */
  isSaved: boolean
}

export function useSurveyDraft({ surveyId, enabled = true }: UseSurveyDraftOptions): UseSurveyDraftReturn {
  const [restoredAnswers, setRestoredAnswers] = useState<Record<string, unknown> | null>(null)
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Load draft on mount
  useEffect(() => {
    if (!enabled) return
    loadDraft(surveyId).then((draft) => {
      if (draft) {
        setRestoredAnswers(draft.answers)
        setHasRestoredDraft(true)
      }
    })
  }, [surveyId, enabled])

  // Debounced save
  const saveAnswers = useCallback(
    (answers: Record<string, unknown>) => {
      if (!enabled) return
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

      saveTimeoutRef.current = setTimeout(() => {
        saveDraft({ surveyId, answers, updatedAt: Date.now() }).then(() => {
          setIsSaved(true)
          if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current)
          savedIndicatorRef.current = setTimeout(() => setIsSaved(false), 2000)
        })
      }, 500) // 500ms debounce
    },
    [surveyId, enabled],
  )

  const clearDraft = useCallback(() => {
    deleteDraft(surveyId)
    setRestoredAnswers(null)
    setHasRestoredDraft(false)
  }, [surveyId])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current)
    }
  }, [])

  return { restoredAnswers, hasRestoredDraft, saveAnswers, clearDraft, isSaved }
}
