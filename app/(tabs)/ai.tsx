import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Markdown } from "@/components/Markdown"
import { useAiChat } from "@/hooks/useAiChat"
import { useApp } from "@/context/AppContext"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { usePressedState } from "@/hooks/usePressedState"
import { withAlpha } from "@/utils/color"
import { confirmAction } from "@/utils/confirm"
import { AI_PRESETS, presetPrompt, type AiPreset } from "@/services/ai/presets"
import type { PendingConfirmation } from "@/services/ai/assistant"
import type { AiChatMessage } from "@/types"
import { fonts } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function summaryOf(pending: PendingConfirmation[]): string {
  const parts = pending.map((item) => {
    const args = item.args
    switch (item.toolName) {
      case "log_food":
        return `Log "${String(args.name ?? "food")}" (${String(args.kcal ?? "?")} kcal)${args.date ? ` on ${String(args.date)}` : ""}`
      case "delete_food_entry":
        return `Delete diary entry ${String(args.entry_id ?? "")}`
      case "set_goals": {
        const fields = ["calorie_goal", "protein_goal", "carbs_goal", "fat_goal"]
          .filter((f) => args[f] !== undefined)
          .map((f) => `${f.replace("_goal", "")} ${String(args[f])}`)
        return `Update goals: ${fields.join(", ")}`
      }
      default:
        return item.toolName
    }
  })
  return parts.join(" · ")
}

function ToolChips({ toolCalls }: { toolCalls: AiChatMessage["tool_calls"] }) {
  const { colors } = useTheme()
  if (!toolCalls?.length) return null
  return (
    <Box className="mt-1.5 flex-row flex-wrap gap-1.5">
      {toolCalls.map((call, index) => (
        <Box
          key={`${call.id}-${index}`}
          className="flex-row items-center gap-1 rounded-none border bg-background-50 px-2 py-0.5"
          style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
        >
          <Feather name="tool" size={11} color={colors.textMuted} />
          <Text
            size="xs"
            className="font-mono uppercase tracking-widest"
            style={{ color: colors.textMuted, fontFamily: fonts.mono, letterSpacing: 0.06 }}
          >
            {call.name}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

export default function AiScreen() {
  const router = useRouter()
  const { settings } = useApp()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { width, isWide, isLarge } = useLayout()
  const { messages, busy, pending, send, stop, confirm, clear } = useAiChat()
  const [draft, setDraft] = useState("")
  const inputRef = useRef<TextInput>(null)
  const headerPress = usePressedState()
  const sendPress = usePressedState()
  const compact = width < 360

  useEffect(() => {
    if (Platform.OS !== "web") return
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
        if (event.key === "Escape") (target as HTMLElement).blur()
        return
      }
      if (event.key === "/" && !busy) {
        event.preventDefault()
        inputRef.current?.focus()
      } else if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        inputRef.current?.focus()
      } else if (event.key === "Escape" && busy) {
        event.preventDefault()
        stop()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [busy, stop])

  const configured = settings.ai_enabled === 1

  const submit = useCallback(() => {
    const text = draft.trim()
    if (!text || busy) return
    setDraft("")
    void send(text)
  }, [busy, draft, send])

  const suggestionPrompts = useMemo(() => AI_PRESETS, [])
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages])

  const runPreset = useCallback(
    (preset: AiPreset) => {
      if (busy) return
      setDraft("")
      void send(presetPrompt(preset))
    },
    [busy, send],
  )

  const handleClearHistory = useCallback(() => {
    confirmAction({
      title: "Clear conversation?",
      message: "This will remove all messages in the AI chat history.",
      confirmLabel: "Clear",
      onConfirm: () => {
        void clear()
      },
    })
  }, [clear])

  const renderMessage = useCallback(
    ({ item }: { item: AiChatMessage }) => {
      if (item.role === "user") {
        return (
          <Box className={`mb-3 w-full flex-row justify-end ${compact ? "pl-6" : "pl-12"}`}>
            <Box
              className="max-w-full rounded-none border px-3.5 py-2.5"
              style={{
                backgroundColor: colors.primary,
                borderWidth: 1.5,
                borderColor: colors.primary,
                borderRadius: 0,
                boxShadow: "none",
                elevation: 0,
              }}
            >
              <Text
                size="sm"
                className="leading-5"
                style={{ color: colors.onPrimary, fontFamily: fonts.mono }}
              >
                {item.content}
              </Text>
              {item.created_at ? (
                <Text
                  size="xs"
                  className="mt-0.5 text-right font-mono tabular-nums"
                  style={{ color: colors.onPrimaryMuted, fontFamily: fonts.mono }}
                >
                  {formatTime(item.created_at)}
                </Text>
              ) : null}
            </Box>
          </Box>
        )
      }

      const hasToolCalls = (item.tool_calls?.length ?? 0) > 0
      const thinking = item.content === "" && !item.is_error && !hasToolCalls
      return (
        <Box
          className={`mb-3 w-full flex-row gap-2.5 ${compact ? "pr-6" : "pr-12"}`}
          style={{ alignItems: "flex-start" }}
        >
          <Box
            className="h-8 w-8 shrink-0 items-center justify-center rounded-none border"
            style={{
              // Ink carries chrome. The violet accent is reserved for data.
              backgroundColor: colors.primary,
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 0,
            }}
          >
            <Feather name="cpu" size={14} color={colors.onPrimary} />
          </Box>
          <Box
            className="rounded-none border px-3.5 py-2.5"
            style={{
              maxWidth: compact ? "82%" : "78%",
              alignSelf: "flex-start",
              flexShrink: 1,
              borderWidth: 1.5,
              borderRadius: 0,
              boxShadow: "none",
              elevation: 0,
              ...(item.is_error
                ? {
                    borderColor: withAlpha(colors.danger, 0.35),
                    backgroundColor: withAlpha(colors.danger, 0.08),
                  }
                : {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }),
            }}
          >
            {thinking ? (
              <Box className="flex-row items-center gap-2 py-0.5">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text
                  size="sm"
                  className="font-mono text-typography-500"
                  style={{ fontFamily: fonts.mono }}
                >
                  Thinking…
                </Text>
              </Box>
            ) : (
              <>
                <Markdown
                  source={item.content || (item.is_error ? "The assistant ran into an error." : "")}
                />
                <ToolChips toolCalls={item.tool_calls} />
                {item.created_at ? (
                  <Text
                    size="xs"
                    className="mt-1.5 font-mono tabular-nums text-typography-400"
                    style={{ fontFamily: fonts.mono }}
                  >
                    {formatTime(item.created_at)}
                  </Text>
                ) : null}
              </>
            )}
          </Box>
        </Box>
      )
    },
    [colors, compact],
  )

  const emptyState = (
    <Box className="items-center px-5 pb-24 pt-8">
      <Box
        className="h-20 w-20 items-center justify-center rounded-none border"
        style={{
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: 0,
          backgroundColor: withAlpha(colors.primary, 0.08),
        }}
      >
        <Box
          className="h-14 w-14 items-center justify-center rounded-none border"
          style={{
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 0,
            backgroundColor: withAlpha(colors.primary, 0.12),
          }}
        >
          <Feather name="cpu" size={28} color={colors.primary} />
        </Box>
      </Box>
      <Text
        size="xl"
        bold
        className="mt-4 text-center font-mono uppercase tracking-widest text-typography-900"
        style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}
      >
        How can I help you eat well?
      </Text>
      <Text
        size="sm"
        className="mt-2 text-center font-mono leading-5 text-typography-500"
        style={{ maxWidth: 380, fontFamily: fonts.mono }}
      >
        Ask about your diary, log foods, or adjust goals. Your data stays private.
      </Text>

      <Box className="mt-5 flex-row flex-wrap justify-center gap-1.5">
        {[
          { icon: "calendar" as const, label: "Review my day", preset: "daily-review" },
          { icon: "activity" as const, label: "Check protein", preset: "protein-check" },
          { icon: "shopping-bag" as const, label: "Plan dinner", preset: "plan-dinner" },
          { icon: "flag" as const, label: "Update goals", preset: "reset-goals" },
        ].map((chip) => (
          <Pressable
            key={chip.label}
            onPress={() => {
              const preset = suggestionPrompts.find((p) => p.id === chip.preset)
              if (preset) runPreset(preset)
            }}
            accessibilityRole="button"
            accessibilityLabel={chip.label}
            className="flex-row items-center gap-1.5 rounded-none border bg-background-50 px-3 py-1.5 active:opacity-80"
            style={{
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 0,
              backgroundColor: colors.surface,
            }}
          >
            <Feather name={chip.icon} size={12} color={colors.primary} />
            <Text
              size="xs"
              bold
              className="font-mono uppercase tracking-widest text-typography-700"
              style={{ fontFamily: fonts.mono, letterSpacing: 0.06 }}
            >
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </Box>

      <Box className="mt-7 w-full">
        <Text
          size="xs"
          bold
          className="mb-2.5 text-center font-mono uppercase tracking-widest text-typography-400"
          style={{ fontFamily: fonts.mono, letterSpacing: 0.08 }}
        >
          Try one of these
        </Text>
        <Box className="w-full flex-row flex-wrap justify-center gap-2">
          {suggestionPrompts.map((preset) => (
            <Pressable
              key={preset.id}
              onPress={() => runPreset(preset)}
              accessibilityRole="button"
              accessibilityLabel={`Preset: ${preset.title}`}
              className="w-[calc(50%-4px)] max-w-[240px] rounded-none border bg-background-50 p-3 active:opacity-80"
              style={{
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 0,
                backgroundColor: colors.surface,
                boxShadow: "none",
                elevation: 0,
              }}
            >
              <Box className="flex-row items-center gap-2">
                <Box
                  className="h-8 w-8 items-center justify-center rounded-none border"
                  style={{
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    borderRadius: 0,
                    backgroundColor: withAlpha(colors.primary, 0.12),
                  }}
                >
                  <Feather
                    name={preset.icon as keyof typeof Feather.glyphMap}
                    size={14}
                    color={colors.primary}
                  />
                </Box>
                <Text
                  size="sm"
                  bold
                  className="flex-1 font-mono uppercase tracking-widest text-typography-900"
                  style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}
                >
                  {preset.title}
                </Text>
              </Box>
              <Text
                size="xs"
                className="mt-1.5 font-mono leading-4 text-typography-500"
                style={{ fontFamily: fonts.mono }}
              >
                {preset.subtitle}
              </Text>
            </Pressable>
          ))}
        </Box>
      </Box>
    </Box>
  )

  const configBanner = (
    <Box
      className="mx-4 mt-3 flex-row items-center gap-3 rounded-none border px-3.5 py-3"
      style={{
        borderWidth: 1.5,
        borderColor: withAlpha(colors.warning, 0.35),
        backgroundColor: withAlpha(colors.warning, 0.08),
        borderRadius: 0,
      }}
    >
      <Feather name="key" size={18} color={colors.warning} />
      <Box className="flex-1">
        <Text
          size="sm"
          bold
          className="font-mono uppercase tracking-widest text-typography-900"
          style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}
        >
          AI Assistant needs setup
        </Text>
        <Text
          size="xs"
          className="mt-0.5 font-mono leading-4 text-typography-500"
          style={{ fontFamily: fonts.mono }}
        >
          Enable it and add an API key in Settings.
        </Text>
      </Box>
      <Pressable
        onPress={() => {
          router.push("/(tabs)/settings")
        }}
        accessibilityRole="button"
        accessibilityLabel="Open AI settings"
        className="rounded-none border bg-warning-500 px-3 py-1.5 active:opacity-80"
        style={{
          borderWidth: 1.5,
          borderColor: colors.warning,
          borderRadius: 0,
          backgroundColor: colors.warning,
        }}
      >
        <Text
          size="xs"
          bold
          className="font-mono uppercase tracking-widest"
          style={{ color: colors.onWarning, fontFamily: fonts.mono, letterSpacing: 0.06 }}
        >
          Setup
        </Text>
      </Pressable>
    </Box>
  )

  const confirmationCard =
    pending.length > 0 ? (
      <Box
        className="mx-4 mb-3 rounded-none border bg-background-50 p-4"
        style={{
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: 0,
          backgroundColor: colors.surface,
        }}
      >
        <Box className="flex-row items-center gap-2">
          <Feather name="alert-circle" size={18} color={colors.warning} />
          <Text
            size="sm"
            bold
            className="flex-1 font-mono uppercase tracking-widest text-typography-900"
            style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}
          >
            Approve changes?
          </Text>
        </Box>
        <Text
          size="sm"
          className="mt-2 font-mono leading-5 text-typography-500"
          style={{ fontFamily: fonts.mono }}
        >
          {summaryOf(pending)}
        </Text>
        <Box className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => void confirm(true)}
            accessibilityRole="button"
            accessibilityLabel="Approve assistant changes"
            className="flex-1 items-center rounded-none border py-2.5 active:opacity-80"
            style={{
              borderWidth: 1.5,
              borderColor: colors.primary,
              borderRadius: 0,
              backgroundColor: colors.primary,
            }}
          >
            <Text
              size="sm"
              bold
              className="font-mono uppercase tracking-widest"
              style={{ color: colors.onPrimary, fontFamily: fonts.mono, letterSpacing: 0.06 }}
            >
              Approve
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void confirm(false)}
            accessibilityRole="button"
            accessibilityLabel="Decline assistant changes"
            className="flex-1 items-center rounded-none border py-2.5 active:opacity-80"
            style={{
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 0,
              backgroundColor: colors.surface,
            }}
          >
            <Text
              size="sm"
              bold
              className="font-mono uppercase tracking-widest text-typography-700"
              style={{ fontFamily: fonts.mono, letterSpacing: 0.06 }}
            >
              Decline
            </Text>
          </Pressable>
        </Box>
      </Box>
    ) : null

  const canSend = draft.trim().length > 0 && !busy && configured

  return (
    <View className="flex-1" style={{ backgroundColor: "transparent" }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: isLarge ? 1360 : isWide ? 1280 : undefined,
          alignSelf: "center",
        }}
      >
        <Box
          style={{
            backgroundColor: colors.primary,
            paddingTop: insets.top > 0 ? insets.top + 8 : 16,
          }}
          className="px-4 pb-3.5"
        >
          <Box className="flex-row items-center justify-between">
            <Box className="min-w-0 flex-1 flex-row items-center gap-2.5">
              <Box
                className="h-10 w-10 shrink-0 items-center justify-center rounded-none border"
                style={{
                  backgroundColor: colors.primaryOverlay,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderRadius: 0,
                }}
              >
                <Feather name="cpu" size={20} color={colors.onPrimary} />
              </Box>
              <Box className="min-w-0">
                <Text
                  size="md"
                  bold
                  className="font-mono uppercase tracking-widest"
                  style={{ color: colors.onPrimary, fontFamily: fonts.mono, letterSpacing: 0.04 }}
                >
                  Dietinator AI
                </Text>
                <Text
                  size="xs"
                  className="font-mono uppercase tracking-widest"
                  style={{
                    color: colors.onPrimaryMuted,
                    fontFamily: fonts.mono,
                    letterSpacing: 0.06,
                  }}
                >
                  Your nutrition assistant
                </Text>
              </Box>
            </Box>
            <Box className="ml-2 flex-row items-center gap-1">
              <Pressable
                onPress={handleClearHistory}
                hitSlop={8}
                onPressIn={headerPress.onPressIn}
                onPressOut={headerPress.onPressOut}
                accessibilityRole="button"
                accessibilityLabel="Clear chat history"
                className="h-9 w-9 items-center justify-center rounded-none border"
                style={[
                  {
                    backgroundColor: colors.primaryOverlay,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    borderRadius: 0,
                  },
                  ...(headerPress.pressed ? [{ opacity: 0.7 }] : []),
                ]}
              >
                <Feather name="trash-2" size={16} color={colors.onPrimary} />
              </Pressable>
            </Box>
          </Box>
        </Box>

        {!configured ? configBanner : null}

        {isWide ? (
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              gap: isLarge ? 20 : 16,
              padding: isLarge ? 20 : 16,
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                width: isLarge ? 340 : 300,
                flexShrink: 0,
                gap: 12,
                alignSelf: "stretch",
              }}
            >
              <Box
                className="rounded-none border bg-background-50 p-4"
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Box className="flex-row items-center gap-2.5">
                  <Box
                    className="h-9 w-9 items-center justify-center rounded-none border"
                    style={{
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      backgroundColor: withAlpha(colors.primary, 0.12),
                    }}
                  >
                    <Feather name="cpu" size={18} color={colors.primary} />
                  </Box>
                  <Box>
                    <Text
                      size="sm"
                      bold
                      className="font-mono uppercase tracking-widest text-typography-900"
                      style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}
                    >
                      Quick prompts
                    </Text>
                    <Text
                      size="2xs"
                      className="font-mono uppercase tracking-widest text-typography-500"
                      style={{ fontFamily: fonts.mono, letterSpacing: 0.06 }}
                    >
                      Tap to send
                    </Text>
                  </Box>
                </Box>
                <Box className="mt-3 gap-2">
                  {suggestionPrompts.map((preset) => (
                    <Pressable
                      key={preset.id}
                      onPress={() => runPreset(preset)}
                      accessibilityRole="button"
                      accessibilityLabel={`Preset: ${preset.title}`}
                      className="rounded-none border bg-background-50 p-3 active:opacity-80"
                      style={{
                        borderWidth: 1.5,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <Box className="flex-row items-center gap-2">
                        <Box
                          className="h-7 w-7 items-center justify-center rounded-none border"
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: withAlpha(colors.primary, 0.1),
                          }}
                        >
                          <Feather
                            name={preset.icon as keyof typeof Feather.glyphMap}
                            size={12}
                            color={colors.primary}
                          />
                        </Box>
                        <Text
                          size="sm"
                          bold
                          className="flex-1 font-mono uppercase tracking-widest text-typography-900"
                          style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}
                        >
                          {preset.title}
                        </Text>
                      </Box>
                      <Text
                        size="xs"
                        className="mt-1 font-mono leading-4 text-typography-500"
                        style={{ fontFamily: fonts.mono }}
                      >
                        {preset.subtitle}
                      </Text>
                    </Pressable>
                  ))}
                </Box>
              </Box>

              <Box
                className="rounded-none border bg-background-50 p-3"
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Text
                  size="2xs"
                  bold
                  className="font-mono uppercase tracking-widest text-typography-500"
                  style={{ fontFamily: fonts.mono, letterSpacing: 0.08 }}
                >
                  Shortcuts
                </Text>
                <Box className="mt-2 gap-1">
                  {[
                    ["Enter", "Send"],
                    ["Esc", "Stop"],
                    ["?", "Help"],
                  ].map(([k, v]) => (
                    <Box key={k} className="flex-row items-center justify-between">
                      <Box
                        className="rounded-none border bg-background-100 px-1.5 py-0.5"
                        style={{ borderWidth: 1, borderColor: colors.border }}
                      >
                        <Text
                          size="2xs"
                          bold
                          className="font-mono text-typography-700"
                          style={{ fontFamily: fonts.mono }}
                        >
                          {k}
                        </Text>
                      </Box>
                      <Text
                        size="2xs"
                        className="font-mono uppercase tracking-widest text-typography-500"
                        style={{ fontFamily: fonts.mono }}
                      >
                        {v}
                      </Text>
                    </Box>
                  ))}
                </Box>
              </Box>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 0,
                alignSelf: "stretch",
                borderWidth: 1.5,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                flexDirection: "column",
              }}
            >
              <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
              >
                {messages.length === 0 ? (
                  <FlatList
                    data={[]}
                    renderItem={null}
                    ListEmptyComponent={
                      <Box className="items-center px-6 py-12">
                        <Box
                          className="h-16 w-16 items-center justify-center rounded-none border"
                          style={{
                            borderWidth: 1.5,
                            borderColor: colors.border,
                            backgroundColor: withAlpha(colors.primary, 0.08),
                          }}
                        >
                          <Feather name="cpu" size={24} color={colors.primary} />
                        </Box>
                        <Text
                          size="md"
                          bold
                          className="mt-4 text-center font-mono uppercase tracking-widest text-typography-900"
                          style={{ fontFamily: fonts.mono }}
                        >
                          How can I help you eat well?
                        </Text>
                        <Text
                          size="sm"
                          className="mt-2 max-w-[420px] text-center font-mono leading-5 text-typography-500"
                          style={{ fontFamily: fonts.mono }}
                        >
                          Ask about your diary, log foods, or adjust goals. Data stays private,
                          prompts run on the left.
                        </Text>
                      </Box>
                    }
                    contentContainerClassName="flex-grow justify-center"
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                  />
                ) : (
                  <FlatList
                    data={reversedMessages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => String(item.id ?? item.created_at)}
                    inverted
                    contentContainerClassName="px-4 pb-20 pt-3"
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                  />
                )}

                {confirmationCard}

                <Box
                  className="border-t bg-background-0 px-3 pb-3 pt-2"
                  style={{ borderTopWidth: 1.5, borderTopColor: colors.border }}
                >
                  <Box className="flex-row items-end gap-2">
                    <Box
                      className="min-w-0 flex-1 justify-center rounded-none border bg-background-100 px-4"
                      style={{
                        minHeight: 44,
                        borderWidth: 1.5,
                        borderColor: colors.border,
                        borderRadius: 0,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <TextInput
                        ref={inputRef as never}
                        value={draft}
                        onChangeText={setDraft}
                        placeholder={
                          configured
                            ? "Ask about your diet…"
                            : "Enable the assistant in Settings first"
                        }
                        placeholderTextColor={colors.textMuted}
                        editable={configured}
                        multiline={Platform.OS !== "web"}
                        style={[styles.input, { color: colors.text, fontFamily: fonts.mono }]}
                        selectionColor={colors.primary}
                        accessibilityLabel="Message the AI assistant"
                        returnKeyType="send"
                        enterKeyHint="send"
                        blurOnSubmit={false}
                        onSubmitEditing={canSend ? submit : undefined}
                      />
                    </Box>
                    {busy ? (
                      <Pressable
                        onPress={stop}
                        accessibilityRole="button"
                        accessibilityLabel="Stop generating"
                        className="h-11 w-11 shrink-0 items-center justify-center rounded-none border active:opacity-80"
                        style={{
                          borderWidth: 1.5,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        }}
                      >
                        <Feather name="x" size={20} color={colors.danger} />
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={submit}
                        disabled={!canSend}
                        onPressIn={sendPress.onPressIn}
                        onPressOut={sendPress.onPressOut}
                        accessibilityRole="button"
                        accessibilityLabel="Send message"
                        className="h-11 w-11 shrink-0 items-center justify-center rounded-none border"
                        style={[
                          {
                            backgroundColor: canSend ? colors.primary : colors.surfaceAlt,
                            borderWidth: 1.5,
                            borderColor: canSend ? colors.primary : colors.border,
                            borderRadius: 0,
                          },
                          ...(sendPress.pressed && canSend ? [{ opacity: 0.85 }] : []),
                        ]}
                      >
                        <Feather
                          name="arrow-up"
                          size={20}
                          color={canSend ? colors.onPrimary : colors.textMuted}
                        />
                      </Pressable>
                    )}
                  </Box>
                </Box>
              </KeyboardAvoidingView>
            </View>
          </View>
        ) : (
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          >
            {messages.length === 0 ? (
              <FlatList
                data={[]}
                renderItem={null}
                ListEmptyComponent={emptyState}
                contentContainerClassName="flex-grow justify-center pb-24"
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
              />
            ) : (
              <FlatList
                data={reversedMessages}
                renderItem={renderMessage}
                keyExtractor={(item) => String(item.id ?? item.created_at)}
                inverted
                contentContainerClassName="px-4 pb-20 pt-3"
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
              />
            )}

            {confirmationCard}

            <Box
              className="border-t bg-background-0 px-3 pb-3 pt-2"
              style={{ borderTopWidth: 1.5, borderTopColor: colors.border }}
            >
              <Box className="flex-row items-end gap-2">
                <Box
                  className="min-w-0 flex-1 justify-center rounded-none border bg-background-100 px-4"
                  style={{
                    minHeight: 44,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    borderRadius: 0,
                    backgroundColor: colors.surface,
                    boxShadow: "none",
                    elevation: 0,
                  }}
                >
                  <TextInput
                    ref={inputRef as never}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={
                      configured ? "Ask about your diet…" : "Enable the assistant in Settings first"
                    }
                    placeholderTextColor={colors.textMuted}
                    editable={configured}
                    multiline={Platform.OS !== "web"}
                    style={[styles.input, { color: colors.text, fontFamily: fonts.mono }]}
                    selectionColor={colors.primary}
                    accessibilityLabel="Message the AI assistant"
                    returnKeyType="send"
                    enterKeyHint="send"
                    blurOnSubmit={false}
                    onSubmitEditing={canSend ? submit : undefined}
                  />
                </Box>
                {busy ? (
                  <Pressable
                    onPress={stop}
                    accessibilityRole="button"
                    accessibilityLabel="Stop generating"
                    className="h-11 w-11 shrink-0 items-center justify-center rounded-none border bg-background-100 active:opacity-80"
                    style={{
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      borderRadius: 0,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Feather name="x" size={20} color={colors.danger} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={submit}
                    disabled={!canSend}
                    onPressIn={sendPress.onPressIn}
                    onPressOut={sendPress.onPressOut}
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                    className="h-11 w-11 shrink-0 items-center justify-center rounded-none border"
                    style={[
                      {
                        backgroundColor: canSend ? colors.primary : colors.surfaceAlt,
                        borderWidth: 1.5,
                        borderColor: canSend ? colors.primary : colors.border,
                        borderRadius: 0,
                        boxShadow: "none",
                        elevation: 0,
                      },
                      ...(sendPress.pressed && canSend ? [{ opacity: 0.85 }] : []),
                    ]}
                  >
                    <Feather
                      name="arrow-up"
                      size={20}
                      color={canSend ? colors.onPrimary : colors.textMuted}
                    />
                  </Pressable>
                )}
              </Box>
            </Box>
          </KeyboardAvoidingView>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  input: {
    fontSize: 14,
    lineHeight: 20,
    maxHeight: 110,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.mono,
  },
})
