import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAiChat } from "@/hooks/useAiChat"
import { useApp } from "@/context/AppContext"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { usePressedState } from "@/hooks/usePressedState"
import { ChatMessage, ChatComposer } from "@/components/ai-chat"
import { withAlpha } from "@/utils/color"
import { confirmAction } from "@/utils/confirm"
import { AI_PRESETS, presetPrompt, type AiPreset } from "@/services/ai/presets"
import type { PendingConfirmation } from "@/services/ai/assistant"
import type { AiChatMessage } from "@/types"
import { fonts, borders, radii } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

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

  const emptyState = (
    <Box className="items-center px-5 pb-24 pt-8">
      <Box
        className="h-20 w-20 items-center justify-center rounded-none border"
        style={{
          borderWidth: borders.width,
          borderColor: colors.border,
          borderRadius: radii.none,
          backgroundColor: withAlpha(colors.weight ?? colors.primary, 0.08),
        }}
      >
        <Box
          className="h-14 w-14 items-center justify-center rounded-none border"
          style={{
            borderWidth: borders.width,
            borderColor: colors.border,
            borderRadius: radii.none,
            backgroundColor: withAlpha(colors.weight ?? colors.primary, 0.12),
          }}
        >
          <Feather name="cpu" size={28} color={colors.weight ?? colors.primary} />
        </Box>
      </Box>
      <Text
        size="xl"
        bold
        className="mt-4 text-center font-mono uppercase tracking-widest"
        style={{ fontFamily: fonts.mono, letterSpacing: 0.04, color: colors.text }}
      >
        How can I help you eat well?
      </Text>
      <Text
        size="sm"
        className="mt-2 text-center font-mono leading-5"
        style={{ maxWidth: 380, fontFamily: fonts.mono, color: colors.textMuted }}
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
            className="flex-row items-center gap-1.5 rounded-none border px-3 py-1.5 active:opacity-80"
            style={{
              borderWidth: borders.width,
              borderColor: colors.border,
              borderRadius: radii.none,
              backgroundColor: colors.surface,
            }}
          >
            <Feather name={chip.icon} size={12} color={colors.weight ?? colors.primary} />
            <Text
              size="xs"
              bold
              className="font-mono uppercase tracking-widest"
              style={{ fontFamily: fonts.mono, letterSpacing: 0.06, color: colors.text }}
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
          className="mb-2.5 text-center font-mono uppercase tracking-widest"
          style={{ fontFamily: fonts.mono, letterSpacing: 0.08, color: colors.textMuted }}
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
              className="w-[calc(50%-4px)] max-w-[240px] rounded-none border p-3 active:opacity-80"
              style={{
                borderWidth: borders.width,
                borderColor: colors.border,
                borderRadius: radii.none,
                backgroundColor: colors.surface,
                boxShadow: "none",
                elevation: 0,
              }}
            >
              <Box className="flex-row items-center gap-2">
                <Box
                  className="h-8 w-8 items-center justify-center rounded-none border"
                  style={{
                    borderWidth: borders.width,
                    borderColor: colors.border,
                    borderRadius: radii.none,
                    backgroundColor: withAlpha(colors.weight ?? colors.primary, 0.12),
                  }}
                >
                  <Feather
                    name={preset.icon as keyof typeof Feather.glyphMap}
                    size={14}
                    color={colors.weight ?? colors.primary}
                  />
                </Box>
                <Text
                  size="sm"
                  bold
                  className="flex-1 font-mono uppercase tracking-widest"
                  style={{ fontFamily: fonts.mono, letterSpacing: 0.04, color: colors.text }}
                >
                  {preset.title}
                </Text>
              </Box>
              <Text
                size="xs"
                className="mt-1.5 font-mono leading-4"
                style={{ fontFamily: fonts.mono, color: colors.textMuted }}
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
        borderWidth: borders.width,
        borderColor: withAlpha(colors.warning, 0.35),
        backgroundColor: withAlpha(colors.warning, 0.08),
        borderRadius: radii.none,
      }}
    >
      <Feather name="key" size={18} color={colors.warning} />
      <Box className="flex-1">
        <Text
          size="sm"
          bold
          className="font-mono uppercase tracking-widest"
          style={{ fontFamily: fonts.mono, letterSpacing: 0.04, color: colors.text }}
        >
          AI Assistant needs setup
        </Text>
        <Text
          size="xs"
          className="mt-0.5 font-mono leading-4"
          style={{ fontFamily: fonts.mono, color: colors.textMuted }}
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
        className="rounded-none border px-3 py-1.5 active:opacity-80"
        style={{
          borderWidth: borders.width,
          borderColor: colors.warning,
          borderRadius: radii.none,
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
        className="mx-4 mb-3 rounded-none border p-4"
        style={{
          borderWidth: borders.width,
          borderColor: colors.border,
          borderRadius: radii.none,
          backgroundColor: colors.surface,
        }}
      >
        <Box className="flex-row items-center gap-2">
          <Feather name="alert-circle" size={18} color={colors.warning} />
          <Text
            size="sm"
            bold
            className="flex-1 font-mono uppercase tracking-widest"
            style={{ fontFamily: fonts.mono, letterSpacing: 0.04, color: colors.text }}
          >
            Approve changes?
          </Text>
        </Box>
        <Text
          size="sm"
          className="mt-2 font-mono leading-5"
          style={{ fontFamily: fonts.mono, color: colors.text }}
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
              borderWidth: borders.width,
              borderColor: colors.primary,
              borderRadius: radii.none,
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
              borderWidth: borders.width,
              borderColor: colors.border,
              borderRadius: radii.none,
              backgroundColor: colors.surface,
            }}
          >
            <Text
              size="sm"
              bold
              className="font-mono uppercase tracking-widest"
              style={{ fontFamily: fonts.mono, letterSpacing: 0.06, color: colors.text }}
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
            backgroundColor: colors.weight ?? colors.primary,
            paddingTop: insets.top > 0 ? insets.top + 8 : 16,
          }}
          className="px-4 pb-3.5"
        >
          <Box className="flex-row items-center justify-between">
            <Box className="min-w-0 flex-1 flex-row items-center gap-2.5">
              <Box
                className="h-10 w-10 shrink-0 items-center justify-center rounded-none border"
                style={{
                  backgroundColor: withAlpha("#ffffff", 0.18),
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  borderRadius: radii.none,
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
                    backgroundColor: withAlpha("#ffffff", 0.18),
                    borderWidth: borders.width,
                    borderColor: colors.border,
                    borderRadius: radii.none,
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
                className="rounded-none border p-4"
                style={{
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Box className="flex-row items-center gap-2.5">
                  <Box
                    className="h-9 w-9 items-center justify-center rounded-none border"
                    style={{
                      borderWidth: borders.width,
                      borderColor: colors.border,
                      backgroundColor: withAlpha(colors.weight ?? colors.primary, 0.12),
                    }}
                  >
                    <Feather name="cpu" size={18} color={colors.weight ?? colors.primary} />
                  </Box>
                  <Box>
                    <Text
                      size="sm"
                      bold
                      className="font-mono uppercase tracking-widest"
                      style={{ fontFamily: fonts.mono, letterSpacing: 0.04, color: colors.text }}
                    >
                      Quick prompts
                    </Text>
                    <Text
                      size="2xs"
                      className="font-mono uppercase tracking-widest"
                      style={{
                        fontFamily: fonts.mono,
                        letterSpacing: 0.06,
                        color: colors.textMuted,
                      }}
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
                      className="rounded-none border p-3 active:opacity-80"
                      style={{
                        borderWidth: borders.width,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <Box className="flex-row items-center gap-2">
                        <Box
                          className="h-7 w-7 items-center justify-center rounded-none border"
                          style={{
                            borderWidth: borders.widthThin,
                            borderColor: colors.border,
                            backgroundColor: withAlpha(colors.weight ?? colors.primary, 0.1),
                          }}
                        >
                          <Feather
                            name={preset.icon as keyof typeof Feather.glyphMap}
                            size={12}
                            color={colors.weight ?? colors.primary}
                          />
                        </Box>
                        <Text
                          size="sm"
                          bold
                          className="flex-1 font-mono uppercase tracking-widest"
                          style={{
                            fontFamily: fonts.mono,
                            letterSpacing: 0.04,
                            color: colors.text,
                          }}
                        >
                          {preset.title}
                        </Text>
                      </Box>
                      <Text
                        size="xs"
                        className="mt-1 font-mono leading-4"
                        style={{ fontFamily: fonts.mono, color: colors.textMuted }}
                      >
                        {preset.subtitle}
                      </Text>
                    </Pressable>
                  ))}
                </Box>
              </Box>

              <Box
                className="rounded-none border p-3"
                style={{
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Text
                  size="2xs"
                  bold
                  className="font-mono uppercase tracking-widest"
                  style={{ fontFamily: fonts.mono, letterSpacing: 0.08, color: colors.textMuted }}
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
                        className="rounded-none border px-1.5 py-0.5"
                        style={{
                          borderWidth: borders.widthThin,
                          borderColor: colors.border,
                          backgroundColor: colors.surfaceAlt,
                        }}
                      >
                        <Text
                          size="2xs"
                          bold
                          className="font-mono"
                          style={{ fontFamily: fonts.mono, color: colors.text }}
                        >
                          {k}
                        </Text>
                      </Box>
                      <Text
                        size="2xs"
                        className="font-mono uppercase tracking-widest"
                        style={{ fontFamily: fonts.mono, color: colors.textMuted }}
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
                borderWidth: borders.width,
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
                            borderWidth: borders.width,
                            borderColor: colors.border,
                            backgroundColor: withAlpha(colors.weight ?? colors.primary, 0.08),
                          }}
                        >
                          <Feather name="cpu" size={24} color={colors.weight ?? colors.primary} />
                        </Box>
                        <Text
                          size="md"
                          bold
                          className="mt-4 text-center font-mono uppercase tracking-widest"
                          style={{ fontFamily: fonts.mono, color: colors.text }}
                        >
                          How can I help you eat well?
                        </Text>
                        <Text
                          size="sm"
                          className="mt-2 max-w-[420px] text-center font-mono leading-5"
                          style={{ fontFamily: fonts.mono, color: colors.textMuted }}
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
                    renderItem={({ item }: { item: AiChatMessage }) => (
                      <ChatMessage item={item} compact={compact} />
                    )}
                    keyExtractor={(item) => String(item.id ?? item.created_at)}
                    inverted
                    contentContainerClassName="px-4 pb-20 pt-3"
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                  />
                )}

                {confirmationCard}

                <ChatComposer
                  draft={draft}
                  setDraft={setDraft}
                  canSend={canSend}
                  busy={busy}
                  configured={configured}
                  onSubmit={submit}
                  onStop={stop}
                  inputRef={inputRef}
                />
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
                renderItem={({ item }: { item: AiChatMessage }) => (
                  <ChatMessage item={item} compact={compact} />
                )}
                keyExtractor={(item) => String(item.id ?? item.created_at)}
                inverted
                contentContainerClassName="px-4 pb-20 pt-3"
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
              />
            )}

            {confirmationCard}

            <ChatComposer
              draft={draft}
              setDraft={setDraft}
              canSend={canSend}
              busy={busy}
              configured={configured}
              onSubmit={submit}
              onStop={stop}
              inputRef={inputRef}
            />
          </KeyboardAvoidingView>
        )}
      </View>
    </View>
  )
}
