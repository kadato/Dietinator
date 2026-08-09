import { useCallback, useMemo, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native"
import { useRouter } from "expo-router"
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { ModalContainer } from "@/components/ModalContainer"
import { Markdown } from "@/components/Markdown"
import { useAiChat } from "@/hooks/useAiChat"
import { useApp } from "@/context/AppContext"
import { useTheme } from "@/hooks/useTheme"
import { AI_PRESETS, presetPrompt, type AiPreset } from "@/services/ai/presets"
import type { PendingConfirmation } from "@/services/ai/assistant"
import type { AiChatMessage } from "@/types"
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
          className="flex-row items-center gap-1 rounded-full border border-outline-100 bg-background-50 px-2 py-0.5"
        >
          <Ionicons name="construct-outline" size={11} color={colors.textMuted} />
          <Text size="xs" style={{ color: colors.textMuted }}>
            {call.name}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

export default function AiChatScreen() {
  const router = useRouter()
  const { settings } = useApp()
  const { colors } = useTheme()
  const { messages, busy, pending, send, stop, confirm, clear } = useAiChat()
  const [draft, setDraft] = useState("")

  const safeClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace("/(tabs)")
    }
  }, [router])

  const configured = settings.ai_enabled === 1

  const submit = useCallback(() => {
    const text = draft.trim()
    if (!text || busy) return
    setDraft("")
    void send(text)
  }, [busy, draft, send])

  const suggestionPrompts = useMemo(() => AI_PRESETS, [])

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
          <Box className="mb-3 w-full flex-row justify-end pl-12">
            <Box
              className="max-w-full rounded-2xl rounded-br-md px-3.5 py-2.5"
              style={{
                backgroundColor: colors.primary,
                boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.18)",
                elevation: 2,
              }}
            >
              <Text size="sm" className="leading-5" style={{ color: colors.onPrimary }}>
                {item.content}
              </Text>
              {item.created_at ? (
                <Text
                  size="xs"
                  className="mt-0.5 text-right"
                  style={{ color: colors.onPrimary, opacity: 0.7 }}
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
        <Box className="mb-3 w-full flex-row gap-2.5 pr-12">
          <Box
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{
              backgroundColor: colors.primaryMuted,
              borderWidth: 2,
              borderColor: `${colors.primaryMuted}55`,
            }}
          >
            <MaterialCommunityIcons name="robot" size={15} color={colors.onPrimary} />
          </Box>
          <Box
            className={`max-w-full flex-1 rounded-2xl rounded-bl-md border px-3.5 py-2.5 ${
              item.is_error
                ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
                : "border-outline-100 bg-background-50"
            }`}
          >
            {thinking ? (
              <Box className="flex-row items-center gap-2 py-0.5">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text size="sm" className="text-typography-500">
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
                  <Text size="xs" className="mt-1.5 text-typography-400">
                    {formatTime(item.created_at)}
                  </Text>
                ) : null}
              </>
            )}
          </Box>
        </Box>
      )
    },
    [colors],
  )

  const emptyState = (
    <Box className="items-center px-5 pb-6 pt-8">
      <Box className="h-20 w-20 items-center justify-center rounded-full bg-primary-500/10">
        <Box className="h-14 w-14 items-center justify-center rounded-full bg-primary-500/15">
          <MaterialCommunityIcons name="robot-outline" size={30} color={colors.primary} />
        </Box>
      </Box>
      <Text size="xl" bold className="mt-4 text-center text-typography-900">
        How can I help you eat well?
      </Text>
      <Text
        size="sm"
        className="mt-2 text-center leading-5 text-typography-500"
        style={{ maxWidth: 380 }}
      >
        Ask about your diary, search foods, log a snack, or adjust your daily goals — all on device.
      </Text>

      <Box className="mt-5 flex-row flex-wrap justify-center gap-1.5">
        {[
          { icon: "calendar-outline", label: "Review my day" },
          { icon: "barbell-outline", label: "Check protein" },
          { icon: "restaurant-outline", label: "Plan dinner" },
          { icon: "flag-outline", label: "Update goals" },
        ].map((chip) => (
          <Box
            key={chip.label}
            className="flex-row items-center gap-1.5 rounded-full border border-outline-100 bg-background-50 px-3 py-1.5"
          >
            <Ionicons
              name={chip.icon as keyof typeof Ionicons.glyphMap}
              size={13}
              color={colors.primary}
            />
            <Text size="xs" bold className="text-typography-700">
              {chip.label}
            </Text>
          </Box>
        ))}
      </Box>

      <Box className="mt-7 w-full">
        <Text size="xs" bold className="mb-2.5 text-center text-typography-400">
          TRY ONE OF THESE
        </Text>
        <Box className="w-full flex-row flex-wrap justify-center gap-2">
          {suggestionPrompts.map((preset) => (
            <Pressable
              key={preset.id}
              onPress={() => runPreset(preset)}
              accessibilityRole="button"
              accessibilityLabel={`Preset: ${preset.title}`}
              className="w-[calc(50%-4px)] max-w-[240px] rounded-2xl border border-outline-100 bg-background-50 p-3 active:opacity-80"
              style={{ boxShadow: "0px 1px 4px rgba(0, 0, 0, 0.06)", elevation: 1 }}
            >
              <Box className="flex-row items-center gap-2">
                <Box className="h-8 w-8 items-center justify-center rounded-full bg-primary-500/15">
                  <Ionicons name={preset.icon} size={16} color={colors.primary} />
                </Box>
                <Text size="sm" bold className="flex-1 text-typography-900">
                  {preset.title}
                </Text>
              </Box>
              <Text size="xs" className="mt-1.5 leading-4 text-typography-500">
                {preset.subtitle}
              </Text>
            </Pressable>
          ))}
        </Box>
      </Box>
    </Box>
  )

  const configBanner = (
    <Box className="mx-4 mt-3 flex-row items-center gap-3 rounded-xl border border-warning-300 bg-warning-50 px-3.5 py-3 dark:border-yellow-800 dark:bg-yellow-950/40">
      <Ionicons name="key-outline" size={18} color={colors.warning} />
      <Box className="flex-1">
        <Text size="sm" bold className="text-typography-900">
          AI Assistant needs setup
        </Text>
        <Text size="xs" className="mt-0.5 leading-4 text-typography-500">
          Enable it and add an API key (OpenAI, OpenRouter, Ollama…) in Settings.
        </Text>
      </Box>
      <Pressable
        onPress={() => router.push("/(tabs)/settings")}
        accessibilityRole="button"
        accessibilityLabel="Open AI settings"
        className="rounded-full bg-warning-500 px-3 py-1.5 active:opacity-85"
      >
        <Text size="xs" bold style={{ color: colors.onWarning }}>
          Setup
        </Text>
      </Pressable>
    </Box>
  )

  const confirmationCard =
    pending.length > 0 ? (
      <Box className="mx-4 mb-3 rounded-2xl border border-outline-200 bg-background-50 p-4">
        <Box className="flex-row items-center gap-2">
          <Ionicons name="hand-left-outline" size={18} color={colors.warning} />
          <Text size="sm" bold className="flex-1 text-typography-900">
            Approve changes?
          </Text>
        </Box>
        <Text size="sm" className="mt-2 leading-5 text-typography-500">
          {summaryOf(pending)}
        </Text>
        <Box className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => void confirm(true)}
            accessibilityRole="button"
            accessibilityLabel="Approve assistant changes"
            className="flex-1 items-center rounded-full bg-primary-500 py-2.5 active:opacity-85"
          >
            <Text size="sm" bold style={{ color: colors.onPrimary }}>
              Approve
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void confirm(false)}
            accessibilityRole="button"
            accessibilityLabel="Decline assistant changes"
            className="flex-1 items-center rounded-full border border-outline-200 py-2.5 active:opacity-80"
          >
            <Text size="sm" bold className="text-typography-700">
              Decline
            </Text>
          </Pressable>
        </Box>
      </Box>
    ) : null

  const canSend = draft.trim().length > 0 && !busy && configured

  return (
    <ModalContainer outerClassName="bg-background-0" maxWidth={720}>
      <Box className="flex-1">
        {/* Header */}
        <Box style={{ backgroundColor: colors.primary }} className="px-4 pb-3.5 pt-3">
          <Box className="flex-row items-center justify-between">
            <Box className="min-w-0 flex-1 flex-row items-center gap-2.5">
              <Box
                className="h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
              >
                <MaterialCommunityIcons name="robot" size={20} color={colors.onPrimary} />
              </Box>
              <Box className="min-w-0">
                <Text size="md" bold style={{ color: colors.onPrimary }}>
                  Dietinator AI
                </Text>
                <Text size="xs" style={{ color: colors.onPrimary, opacity: 0.78 }}>
                  Your nutrition assistant
                </Text>
              </Box>
            </Box>
            <Box className="ml-2 flex-row items-center gap-1">
              <Box
                className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
              >
                <Box className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <Text size="2xs" bold style={{ color: colors.onPrimary }}>
                  ON DEVICE
                </Text>
              </Box>
              <Pressable
                onPress={() => void clear()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear chat history"
                className="ml-1 h-9 w-9 items-center justify-center rounded-full"
                style={({ pressed }) => [
                  { backgroundColor: "rgba(255,255,255,0.18)" },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="trash-outline" size={19} color={colors.onPrimary} />
              </Pressable>
              <Pressable
                onPress={safeClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close AI chat"
                className="h-9 w-9 items-center justify-center rounded-full"
                style={({ pressed }) => [
                  { backgroundColor: "rgba(255,255,255,0.18)" },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="close" size={22} color={colors.onPrimary} />
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
              contentContainerClassName="flex-grow justify-center"
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            <FlatList
              data={[...messages].reverse()}
              renderItem={renderMessage}
              keyExtractor={(item) => String(item.id ?? item.created_at)}
              inverted
              contentContainerClassName="px-4 pb-2 pt-3"
              keyboardShouldPersistTaps="handled"
            />
          )}

          {confirmationCard}

          {/* Composer */}
          <Box className="border-t border-outline-100 bg-background-0 px-3 pb-3 pt-2">
            <Box className="flex-row items-end gap-2">
              <Box
                className="min-w-0 flex-1 rounded-[22px] border border-outline-200 bg-background-100 px-4"
                style={{ boxShadow: "0px 1px 4px rgba(0, 0, 0, 0.06)", elevation: 1 }}
              >
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={
                    configured ? "Ask about your diet…" : "Enable the assistant in Settings first"
                  }
                  placeholderTextColor={colors.textMuted}
                  editable={configured}
                  multiline
                  style={[styles.input, { color: colors.text }]}
                  selectionColor={colors.primary}
                  accessibilityLabel="Message the AI assistant"
                  onSubmitEditing={canSend ? submit : undefined}
                />
              </Box>
              {busy ? (
                <Pressable
                  onPress={stop}
                  accessibilityRole="button"
                  accessibilityLabel="Stop generating"
                  className="h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-200 bg-background-100 active:opacity-80"
                >
                  <Ionicons name="stop" size={20} color={colors.danger} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={submit}
                  disabled={!canSend}
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  className="h-11 w-11 shrink-0 items-center justify-center rounded-full"
                  style={({ pressed }) => [
                    {
                      backgroundColor: canSend ? colors.primary : colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: canSend ? colors.primary : colors.border,
                      boxShadow: canSend ? "0px 3px 12px rgba(0, 0, 0, 0.25)" : undefined,
                      elevation: canSend ? 4 : 0,
                    },
                    pressed && canSend && { transform: [{ scale: 0.92 }] },
                  ]}
                >
                  <Ionicons
                    name="arrow-up"
                    size={22}
                    color={canSend ? colors.onPrimary : colors.textMuted}
                  />
                </Pressable>
              )}
            </Box>
          </Box>
        </KeyboardAvoidingView>
      </Box>
    </ModalContainer>
  )
}

const styles = StyleSheet.create({
  input: {
    fontSize: 16,
    lineHeight: 20,
    maxHeight: 110,
    minHeight: 44,
    paddingTop: 2,
    paddingBottom: 2,
  },
})
