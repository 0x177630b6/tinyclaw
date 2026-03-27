"use client"

import { useEffect, useRef, useCallback, useMemo } from "react"
import { subscribeToEvents } from "./api"

type Listener = () => void
const listenerMap = new Map<string, Set<Listener>>()
let unsubscribe: (() => void) | null = null

function ensureConnection() {
  if (unsubscribe) return
  unsubscribe = subscribeToEvents(
    (event) => {
      const type = event.type
      if (!type) return
      const listeners = listenerMap.get(type)
      if (listeners) {
        listeners.forEach((cb) => cb())
      }
    },
    () => {
      // On error, close the old connection and retry after a delay
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      if (listenerMap.size > 0) {
        setTimeout(() => ensureConnection(), 3000)
      }
    }
  )
}

function addListener(eventType: string, cb: Listener) {
  if (!listenerMap.has(eventType)) {
    listenerMap.set(eventType, new Set())
  }
  listenerMap.get(eventType)!.add(cb)
  ensureConnection()
}

function removeListener(eventType: string, cb: Listener) {
  const set = listenerMap.get(eventType)
  if (set) {
    set.delete(cb)
    if (set.size === 0) listenerMap.delete(eventType)
  }
  if (listenerMap.size === 0 && unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
}

export function useSSEInvalidation(
  eventTypes: string[],
  onInvalidate: () => void,
  debounceMs = 250
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(onInvalidate)
  callbackRef.current = onInvalidate

  const debouncedInvalidate = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      callbackRef.current()
    }, debounceMs)
  }, [debounceMs])

  // Stable key so the effect doesn't re-run when callers pass a fresh array with same contents
  const eventKey = useMemo(() => eventTypes.slice().sort().join(","), [eventTypes])

  useEffect(() => {
    eventTypes.forEach((t) => addListener(t, debouncedInvalidate))
    return () => {
      eventTypes.forEach((t) => removeListener(t, debouncedInvalidate))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [eventKey, debouncedInvalidate])
}
