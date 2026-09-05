import { useCallback, useMemo, useState } from "react"
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChatMessage, ChatComposer } from "@/components/ai-chat"
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
import { fonts, borders, radii } from "@/theme"
import { useEscapeToClose } from "@/hooks/useEscapeToClose"

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
  const safeTop = insets.top > 0 ? insets.top : Platform.OS === "android" ? 24 : 0
  const safeBottom = insets.bottom
  const { width, isWide } = useLayout()
  const { messages, busy, pending, send, stop, confirm, clear } = useAiChat()
  const [draft, setDraft] = useState("")
  const headerPress = usePressedState()
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

  const emptyState = (
    <Box className="items-center px-5 pb-24 pt-8">
      <Box
        className="h-20 w-20 items-center justify-center rounded-none border"
        style={{
          borderWidth: borders.width,
          borderColor: colors.border,
          borderRadius: radii.none,
          backgroundColor: `${colors.primary}10`,
          boxShadow: "none",
          elevation: 0,
        }}
      >
        <Box
          className="h-14 w-14 items-center justify-center rounded-none border"
          style={{
            borderWidth: borders.width,
            borderColor: colors.border,
            borderRadius: radii.none,
            backgroundColor: `${colors.primary}18`,
            boxShadow: "none",
            elevation: 0,
          }}
        >
          <Feather name="cpu" size={28} color={colors.weight ?? colors.primary} />
        </Box>
      </Box>
      <Text
        size="xl"
        bold
        className="mt-4 text-center"
        style={{
          color: colors.text,
          fontFamily: fonts.mono,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        How can I help you eat well?
      </Text>
      <Text
        size="sm"
        className="mt-2 text-center leading-5"
        style={{
          color: colors.textMuted,
          maxWidth: 380,
          fontFamily: fonts.mono,
          fontVariant: ["tabular-nums"],
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
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
              className=""
              style={{
                color: colors.text,
                fontFamily: fonts.mono,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
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
          className="mb-2.5 text-center"
          style={{
            color: colors.textMuted,
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
                    boxShadow: "none",
                    elevation: 0,
                  }}
                >
                  <Feather
                    name={preset.icon as keyof typeof Feather.glyphMap}
                    size={16}
                    color={colors.weight ?? colors.primary}
                  />
                </Box>
                <Text
                  size="sm"
                  bold
                  className="flex-1"
                  style={{
                    color: colors.text,
                    fontFamily: fonts.mono,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  {preset.title}
                </Text>
              </Box>
              <Text
                size="xs"
                className="mt-1.5 leading-4"
                style={{ color: colors.textMuted, fontFamily: fonts.mono, letterSpacing: 0.2 }}
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
        boxShadow: "none",
        elevation: 0,
      }}
    >
      <Feather name="key" size={16} color={colors.warning} />
      <Box className="flex-1">
        <Text
          size="sm"
          bold
          className=""
          style={{
            color: colors.text,
            fontFamily: fonts.mono,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          AI Assistant needs setup
        </Text>
        <Text
          size="xs"
          className="mt-0.5 leading-4"
          style={{ color: colors.textMuted, fontFamily: fonts.mono, letterSpacing: 0.2 }}
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
        className="rounded-none border px-3 py-1.5 active:opacity-80"
        style={{
          borderWidth: borders.width,
          borderColor: colors.warning,
          borderRadius: radii.none,
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
        className="mx-4 mb-3 rounded-none border p-4"
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
          <Feather name="alert-circle" size={16} color={colors.warning} />
          <Text
            size="sm"
            bold
            className="flex-1"
            style={{
              color: colors.text,
              fontFamily: fonts.mono,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Approve changes?
          </Text>
        </Box>
        <Text
          size="sm"
          className="mt-2 leading-5"
          style={{ color: colors.textMuted, fontFamily: fonts.mono, letterSpacing: 0.2 }}
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
              borderWidth: borders.width,
              borderColor: colors.border,
              borderRadius: radii.none,
              backgroundColor: colors.surfaceAlt,
              boxShadow: "none",
              elevation: 0,
            }}
          >
            <Text
              size="sm"
              bold
              className=""
              style={{
                color: colors.text,
                fontFamily: fonts.mono,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
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
        style={{
          backgroundColor: colors.weight ?? colors.primary,
          paddingTop: safeTop + 12,
          paddingLeft: insets.left + 16,
          paddingRight: insets.right + 16,
        }}
        className="pb-3.5"
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
                  backgroundColor: withAlpha("#ffffff", 0.18),
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  borderRadius: radii.none,
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
                  backgroundColor: withAlpha("#ffffff", 0.18),
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  borderRadius: radii.none,
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
          bottomPad={safeBottom}
        />
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
                  borderRadius: radii.none,
                  borderWidth: borders.width,
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
              {
                backgroundColor: colors.surface,
                borderRadius: radii.none,
                boxShadow: "none",
                elevation: 0,
              },
            ]}
          >
            {chat}
          </View>
        )}

        {isWide ? (
          <FabCluster
            bottomOffset={safeBottom + 24}
            left={<Fab tone="surface" icon="x" onPress={closeAiChat} accessibilityLabel="Cancel" />}
          />
        ) : null}
      </View>
    </Modal>
  )
}
