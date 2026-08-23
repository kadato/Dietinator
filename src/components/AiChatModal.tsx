import { useCallback, useMemo, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { createModalShellStyles } from "@/components/modal-shell"
import { useAiChat } from "@/hooks/useAiChat"
import { useApp } from "@/context/AppContext"
import { useAiChatModal } from "@/context/AiChatContext"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { usePressedState } from "@/hooks/usePressedState"
import { withAlpha } from "@/utils/color"
import { AI_PRESETS, presetPrompt, type AiPreset } from "@/services/ai/presets"
import type { PendingConfirmation } from "@/services/ai/assistant"
import type { AiChatMessage } from "@/types"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { fonts } from "@/theme"
import { useEscapeToClose } from "@/hooks/useEscapeToClose"

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
  return parts.join(", ")
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
          style={{
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 0,
            backgroundColor: colors.surface,
            boxShadow: "none",
            elevation: 0,
          }}
        >
          <Feather name="tool" size={11} color={colors.textMuted} />
          <Text
            size="xs"
            style={{
              color: colors.textMuted,
              fontFamily: fonts.mono,
              fontVariant: ["tabular-nums"],
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            {call.name}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

export function AiChatModal() {
  const { open } = useAiChatModal()
  if (!open) return null
  return <AiChatModalContent />
}

function AiChatModalContent() {
  const router = useRouter()
  const { settings } = useApp()
  const { open, closeAiChat } = useAiChatModal()
  useEscapeToClose(open, closeAiChat)
  const { colors } = useTheme()
  const shell = createModalShellStyles(colors)
  const insets = useSafeAreaInsets()
  const { width, isWide } = useLayout()
  const { messages, busy, pending, send, stop, confirm, clear } = useAiChat()
  const [draft, setDraft] = useState("")
  const headerPress = usePressedState()
  const sendPress = usePressedState()
  const compact = width < 360

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
                style={{
                  color: colors.onPrimary,
                  fontFamily: fonts.mono,
                  letterSpacing: 0.2,
                }}
              >
                {item.content}
              </Text>
              {item.created_at ? (
                <Text
                  size="xs"
                  className="mt-1 text-right"
                  style={{
                    color: colors.onPrimaryMuted,
                    fontFamily: fonts.mono,
                    fontVariant: ["tabular-nums"],
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
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
        <Box className={`mb-3 w-full flex-row gap-2.5 ${compact ? "pr-6" : "pr-12"}`}>
          <Box
            className="h-8 w-8 items-center justify-center rounded-none border"
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 0,
              boxShadow: "none",
              elevation: 0,
            }}
          >
            <Feather name="cpu" size={14} color={colors.primary} />
          </Box>
          <Box
            className="max-w-full flex-1 rounded-none border px-3.5 py-2.5"
            style={{
              borderWidth: 1.5,
              borderColor: item.is_error ? withAlpha(colors.danger, 0.35) : colors.border,
              backgroundColor: item.is_error ? withAlpha(colors.danger, 0.08) : colors.surface,
              borderRadius: 0,
              boxShadow: "none",
              elevation: 0,
            }}
          >
            {thinking ? (
              <Box className="flex-row items-center gap-2 py-0.5">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text
                  size="sm"
                  className="text-typography-500"
                  style={{
                    fontFamily: fonts.mono,
                    fontVariant: ["tabular-nums"],
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
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
                    className="mt-1.5 text-typography-400"
                    style={{
                      fontFamily: fonts.mono,
                      fontVariant: ["tabular-nums"],
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                    }}
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
        className="h-20 w-20 items-center justify-center rounded-none border bg-primary-500/10"
        style={{
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: 0,
          backgroundColor: `${colors.primary}10`,
          boxShadow: "none",
          elevation: 0,
        }}
      >
        <Box
          className="h-14 w-14 items-center justify-center rounded-none border bg-primary-500/15"
          style={{
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 0,
            backgroundColor: `${colors.primary}18`,
            boxShadow: "none",
            elevation: 0,
          }}
        >
          <Feather name="cpu" size={28} color={colors.primary} />
        </Box>
      </Box>
      <Text
        size="xl"
        bold
        className="mt-4 text-center text-typography-900"
        style={{ fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: 0.4 }}
      >
        How can I help you eat well?
      </Text>
      <Text
        size="sm"
        className="mt-2 text-center leading-5 text-typography-500"
        style={{
          maxWidth: 380,
          fontFamily: fonts.mono,
          fontVariant: ["tabular-nums"],
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        Ask about your diary, log foods, or adjust goals. All on device.
      </Text>

      <Box className="mt-5 flex-row flex-wrap justify-center gap-1.5">
        {[
          { icon: "calendar" as const, label: "Review my day" },
          { icon: "activity" as const, label: "Check protein" },
          { icon: "shopping-bag" as const, label: "Plan dinner" },
          { icon: "flag" as const, label: "Update goals" },
        ].map((chip) => (
          <Box
            key={chip.label}
            className="flex-row items-center gap-1.5 rounded-none border bg-background-50 px-3 py-1.5"
            style={{
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 0,
              backgroundColor: colors.surface,
              boxShadow: "none",
              elevation: 0,
            }}
          >
            <Feather name={chip.icon} size={12} color={colors.primary} />
            <Text
              size="xs"
              bold
              className="text-typography-700"
              style={{
                fontFamily: fonts.mono,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {chip.label}
            </Text>
          </Box>
        ))}
      </Box>

      <Box className="mt-7 w-full">
        <Text
          size="xs"
          bold
          className="mb-2.5 text-center text-typography-400"
          style={{
            fontFamily: fonts.mono,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
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
                  className="h-8 w-8 items-center justify-center rounded-none border bg-primary-500/15"
                  style={{
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    borderRadius: 0,
                    boxShadow: "none",
                    elevation: 0,
                  }}
                >
                  <Feather
                    name={preset.icon as keyof typeof Feather.glyphMap}
                    size={16}
                    color={colors.primary}
                  />
                </Box>
                <Text
                  size="sm"
                  bold
                  className="flex-1 text-typography-900"
                  style={{ fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: 0.4 }}
                >
                  {preset.title}
                </Text>
              </Box>
              <Text
                size="xs"
                className="mt-1.5 leading-4 text-typography-500"
                style={{ fontFamily: fonts.mono, letterSpacing: 0.2 }}
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
        boxShadow: "none",
        elevation: 0,
      }}
    >
      <Feather name="key" size={16} color={colors.warning} />
      <Box className="flex-1">
        <Text
          size="sm"
          bold
          className="text-typography-900"
          style={{ fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: 0.4 }}
        >
          AI Assistant needs setup
        </Text>
        <Text
          size="xs"
          className="mt-0.5 leading-4 text-typography-500"
          style={{ fontFamily: fonts.mono, letterSpacing: 0.2 }}
        >
          Enable it and add an API key in Settings.
        </Text>
      </Box>
      <Pressable
        onPress={() => {
          closeAiChat()
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
          boxShadow: "none",
          elevation: 0,
        }}
      >
        <Text
          size="xs"
          bold
          style={{
            color: colors.onWarning,
            fontFamily: fonts.mono,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
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
          boxShadow: "none",
          elevation: 0,
        }}
      >
        <Box className="flex-row items-center gap-2">
          <Feather name="alert-circle" size={16} color={colors.warning} />
          <Text
            size="sm"
            bold
            className="flex-1 text-typography-900"
            style={{ fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: 0.4 }}
          >
            Approve changes?
          </Text>
        </Box>
        <Text
          size="sm"
          className="mt-2 leading-5 text-typography-500"
          style={{ fontFamily: fonts.mono, letterSpacing: 0.2 }}
        >
          {summaryOf(pending)}
        </Text>
        <Box className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => void confirm(true)}
            accessibilityRole="button"
            accessibilityLabel="Approve assistant changes"
            className="flex-1 items-center rounded-none border bg-primary-500 py-2.5 active:opacity-80"
            style={{
              borderWidth: 1.5,
              borderColor: colors.primary,
              borderRadius: 0,
              backgroundColor: colors.primary,
              boxShadow: "none",
              elevation: 0,
            }}
          >
            <Text
              size="sm"
              bold
              style={{
                color: colors.onPrimary,
                fontFamily: fonts.mono,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
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
              backgroundColor: colors.surfaceAlt,
              boxShadow: "none",
              elevation: 0,
            }}
          >
            <Text
              size="sm"
              bold
              className="text-typography-700"
              style={{ fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: 0.4 }}
            >
              Decline
            </Text>
          </Pressable>
        </Box>
      </Box>
    ) : null

  const canSend = draft.trim().length > 0 && !busy && configured

  const chat = (
    <Box className="flex-1">
      <Box
        style={{ backgroundColor: colors.primary, paddingTop: insets.top + 12 }}
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
                boxShadow: "none",
                elevation: 0,
              }}
            >
              <Feather name="cpu" size={18} color={colors.onPrimary} />
            </Box>
            <Box className="min-w-0">
              <Text
                size="md"
                bold
                style={{
                  color: colors.onPrimary,
                  fontFamily: fonts.mono,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                Dietinator AI
              </Text>
              <Text
                size="xs"
                style={{
                  color: colors.onPrimaryMuted,
                  fontFamily: fonts.mono,
                  fontVariant: ["tabular-nums"],
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                Your nutrition assistant
              </Text>
            </Box>
          </Box>
          <Box className="ml-2 flex-row items-center gap-1">
            <Box
              className="flex-row items-center gap-1.5 rounded-none border px-2.5 py-1"
              style={{
                backgroundColor: colors.primaryOverlay,
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 0,
                boxShadow: "none",
                elevation: 0,
              }}
            >
              <Box
                className="h-1.5 w-1.5 rounded-none border"
                style={{
                  backgroundColor: colors.onPrimary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 0,
                }}
              />
              <Text
                size="2xs"
                bold
                style={{
                  color: colors.onPrimary,
                  fontFamily: fonts.mono,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                On device
              </Text>
            </Box>
            <Pressable
              onPress={() => void clear()}
              hitSlop={8}
              onPressIn={headerPress.onPressIn}
              onPressOut={headerPress.onPressOut}
              accessibilityRole="button"
              accessibilityLabel="Clear chat history"
              className="ml-1 h-9 w-9 items-center justify-center rounded-none border"
              style={[
                {
                  backgroundColor: colors.primaryOverlay,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderRadius: 0,
                  boxShadow: "none",
                  elevation: 0,
                },
                ...(headerPress.pressed ? [{ opacity: 0.7 }] : []),
              ]}
            >
              <Feather name="trash-2" size={16} color={colors.onPrimary} />
            </Pressable>
            <Pressable
              onPress={closeAiChat}
              hitSlop={8}
              onPressIn={headerPress.onPressIn}
              onPressOut={headerPress.onPressOut}
              accessibilityRole="button"
              accessibilityLabel="Close AI chat"
              className="h-9 w-9 items-center justify-center rounded-none border"
              style={[
                {
                  backgroundColor: colors.primaryOverlay,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderRadius: 0,
                  boxShadow: "none",
                  elevation: 0,
                },
                ...(headerPress.pressed ? [{ opacity: 0.7 }] : []),
              ]}
            >
              <Feather name="x" size={18} color={colors.onPrimary} />
            </Pressable>
          </Box>
        </Box>
      </Box>

      {!configured ? configBanner : null}

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
          className="border-t bg-background-0 px-3 pt-2"
          style={{
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1.5,
            borderTopColor: colors.border,
            borderRadius: 0,
          }}
        >
          <Box className="flex-row items-end gap-2">
            <Pressable
              onPress={closeAiChat}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close AI chat"
              className="h-11 w-11 shrink-0 items-center justify-center rounded-none border bg-background-100 active:opacity-70"
              style={{
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 0,
                backgroundColor: colors.surfaceAlt,
                boxShadow: "none",
                elevation: 0,
              }}
            >
              <Feather name="chevron-down" size={18} color={colors.text} />
            </Pressable>
            <Box
              className="min-w-0 flex-1 justify-center rounded-none border bg-background-100 px-4"
              style={{
                minHeight: 44,
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 0,
                backgroundColor: colors.surfaceAlt,
                boxShadow: "none",
                elevation: 0,
              }}
            >
              <TextInput
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
                  backgroundColor: colors.surfaceAlt,
                  boxShadow: "none",
                  elevation: 0,
                }}
              >
                <Feather name="square" size={16} color={colors.danger} />
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
                  size={18}
                  color={canSend ? colors.onPrimary : colors.textMuted}
                />
              </Pressable>
            )}
          </Box>
        </Box>
      </KeyboardAvoidingView>
    </Box>
  )

  return (
    <Modal
      visible={open}
      transparent
      // Match sibling dialogs: fade when centered, slide as a phone sheet.
      // A modal that snaps open breaks modality perception.
      animationType={isWide ? "fade" : "slide"}
      onRequestClose={closeAiChat}
      statusBarTranslucent
    >
      <View style={shell.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeAiChat}
          accessibilityRole="button"
          accessibilityLabel="Dismiss AI chat"
        />
        {isWide ? (
          <View pointerEvents="box-none" style={shell.dialogWrap}>
            <View
              testID="ai-chat-dialog"
              accessibilityViewIsModal={true}
              style={[
                shell.dialogBox,
                {
                  width: "100%",
                  maxWidth: 720,
                  height: "100%",
                  borderRadius: 0,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  boxShadow: "none",
                  elevation: 0,
                },
              ]}
            >
              {chat}
            </View>
          </View>
        ) : (
          <View
            accessibilityViewIsModal={true}
            style={[
              shell.sheet,
              { backgroundColor: colors.surface, borderRadius: 0, boxShadow: "none", elevation: 0 },
            ]}
          >
            {chat}
          </View>
        )}

        {isWide ? (
          <FabCluster
            bottomOffset={insets.bottom + 24}
            left={<Fab tone="surface" icon="x" onPress={closeAiChat} accessibilityLabel="Cancel" />}
          />
        ) : null}
      </View>
    </Modal>
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
