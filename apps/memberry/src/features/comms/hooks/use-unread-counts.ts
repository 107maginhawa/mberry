import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'comms:lastReadAt'

/**
 * Manages per-room read state using localStorage.
 * Returns unread status based on room's lastMessageAt vs stored lastReadAt.
 * Will migrate to server-side lastReadAt via API when endpoint is available.
 */

function getStore(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setStore(data: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  // Dispatch event so all subscribers re-render
  window.dispatchEvent(new Event('comms-read-state'))
}

function subscribe(cb: () => void) {
  window.addEventListener('comms-read-state', cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener('comms-read-state', cb)
    window.removeEventListener('storage', cb)
  }
}

let cachedSnapshot: Record<string, string> = getStore()

function getSnapshot(): Record<string, string> {
  // Re-read on each call (cheap — single localStorage read)
  const fresh = getStore()
  // Only update reference if data changed (avoid unnecessary re-renders)
  if (JSON.stringify(fresh) !== JSON.stringify(cachedSnapshot)) {
    cachedSnapshot = fresh
  }
  return cachedSnapshot
}

export function useUnreadCounts() {
  const readState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const markRead = useCallback((roomId: string) => {
    const store = getStore()
    store[roomId] = new Date().toISOString()
    setStore(store)
  }, [])

  const hasUnread = useCallback(
    (roomId: string, lastMessageAt?: string | Date | null): boolean => {
      if (!lastMessageAt) return false
      const lastRead = readState[roomId]
      if (!lastRead) return true // Never read = unread
      return new Date(lastMessageAt).getTime() > new Date(lastRead).getTime()
    },
    [readState],
  )

  return { markRead, hasUnread }
}
