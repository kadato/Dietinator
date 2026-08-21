import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AiAssistant,
  visibleMessages,
  type PendingConfirmation,
  type TurnCallbacks,
} from "@/services/ai/assistant"
import type { AiChatMessage } from "@/types"

/**
 * Stateful wrapper around the AiAssistant singleton-per-screen. Exposes the
 * visible conversation, busy/pending flags, and the actions the chat UI needs.
 */
export function useAiChat() {
  const assistantRef = useRef<AiAssistant | null>(null)
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingConfirmation[]>([])
  const [loaded, setLoaded] = useState(false)

  const getAssistant = useCallback(() => {
    if (!assistantRef.current) assistantRef.current = new AiAssistant()
    return assistantRef.current
  }, [])

  const refresh = useCallback(async () => {
    const all = await getAssistant().loadHistory()
    setMessages(visibleMessages(all))
  }, [getAssistant])

  useEffect(() => {
    let cancelled = false
    void refresh()
      .then(() => {
        if (!cancelled) setLoaded(true)
      })
      // History is best-effort; a transient DB error must not surface as an
      // unhandled rejection (for examplethe SQLite worker re-initializing on web
      // after a page reload).
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [refresh])

  const callbacks = useMemo<TurnCallbacks>(
    () => ({
      onMessages: () => {
        void refresh()
      },
      onConfirmation: (next) => setPending(next),
      onTurnEnd: () => setBusy(false),
    }),
    [refresh],
  )

  const send = useCallback(
    async (text: string) => {
      setBusy(true)
      await getAssistant().sendMessage(text, callbacks)
    },
    [callbacks, getAssistant],
  )

  const stop = useCallback(() => {
    getAssistant().cancel()
    setBusy(false)
  }, [getAssistant])

  const confirm = useCallback(
    async (approved: boolean) => {
      await getAssistant().resolveConfirmation(approved, callbacks)
    },
    [callbacks, getAssistant],
  )

  const clear = useCallback(async () => {
    await getAssistant().clearHistory()
    setPending([])
    setBusy(false)
    await refresh()
  }, [getAssistant, refresh])

  return {
    loaded,
    messages,
    busy,
    pending,
    send,
    stop,
    confirm,
    clear,
  }
}
