import React, { createContext, useCallback, useContext, useMemo, useState } from "react"

type AiChatModalValue = {
  open: boolean
  openAiChat: () => void
  closeAiChat: () => void
}

const AiChatModalContext = createContext<AiChatModalValue | null>(null)

/**
 * Global open/close state for the AI chat overlay. The chat is a true modal
 * (React Native `Modal`), not a route, because stack modals do not dim the screen
 * behind on web, so a route-based chat reads as a full page there.
 */
export function AiChatModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const openAiChat = useCallback(() => setOpen(true), [])
  const closeAiChat = useCallback(() => setOpen(false), [])

  const value = useMemo(() => ({ open, openAiChat, closeAiChat }), [open, openAiChat, closeAiChat])

  return <AiChatModalContext.Provider value={value}>{children}</AiChatModalContext.Provider>
}

export function useAiChatModal() {
  const ctx = useContext(AiChatModalContext)
  if (!ctx) throw new Error("useAiChatModal must be used within AiChatModalProvider")
  return ctx
}
