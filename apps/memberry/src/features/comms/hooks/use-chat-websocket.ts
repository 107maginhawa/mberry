import { useEffect, useRef, useCallback, useState } from 'react'

interface UseChatWebSocketReturn {
  isConnected: boolean
  isReconnecting: boolean
  send: (type: string, data: unknown) => void
}

/**
 * WebSocket hook for chat room real-time communication.
 * Handles connection, reconnection with exponential backoff, and keep-alive pings.
 */
export function useChatWebSocket(
  roomId: string,
  onMessage: (msg: unknown) => void,
): UseChatWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const intentionalCloseRef = useRef(false)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onMessageRef = useRef(onMessage)

  // Keep callback ref current without re-triggering effect
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/api/ws/comms/chat-rooms/${roomId}`
  }, [roomId])

  const clearTimers = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current)
      pingTimerRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(getWsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      setIsReconnecting(false)
      retryCountRef.current = 0

      // Keep-alive ping every 30s
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30_000)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // Handle pong silently
        if (data.type === 'pong') return
        onMessageRef.current(data)
      } catch {
        // Non-JSON message, ignore
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      clearTimers()

      if (!intentionalCloseRef.current) {
        setIsReconnecting(true)
        const backoff = Math.min(1000 * 2 ** retryCountRef.current, 30_000)
        retryCountRef.current += 1
        retryTimerRef.current = setTimeout(connect, backoff)
      }
    }

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    }
  }, [getWsUrl, clearTimers])

  const send = useCallback((type: string, data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data as Record<string, unknown> }))
    }
  }, [])

  useEffect(() => {
    intentionalCloseRef.current = false
    connect()

    return () => {
      intentionalCloseRef.current = true
      clearTimers()
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect, clearTimers])

  return { isConnected, isReconnecting, send }
}
