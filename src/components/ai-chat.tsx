import { useState } from "react"
import type { RefObject } from "react"
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput } from "react-native"
import { Feather } from "@expo/vector-icons"
import { Markdown } from "@/components/Markdown"
import { useTheme } from "@/hooks/useTheme"
import { withAlpha } from "@/utils/color"
import { formatTimeHM } from "@/utils/format"
import type { AiChatMessage } from "@/types"
import { fonts, borders, radii } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

/**
 * Chat bubbles and composer shared by the AI tab and the AI chat modal.
 * One copy only: the modal drifted gray because the two copies were edited
 * separately, so new chat UI goes here, never in a second copy.
 */

export function ChatToolChips({ toolCalls }: { toolCalls: AiChatMessage["tool_calls"] }) {
  const { colors } = useTheme()
  if (!toolCalls?.length) return null
  return (
    <Box className="mt-1.5 flex-row flex-wrap gap-1.5">
      {toolCalls.map((call, index) => (
        <Box
          key={`${call.id}-${index}`}
          className="flex-row items-center gap-1 rounded-none border px-2 py-0.5"
          style={{
            borderWidth: borders.width,
            borderColor: colors.border,
            borderRadius: radii.none,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <Feather name="tool" size={11} color={colors.textMuted} />
          <Text
            size="xs"
            className="font-mono uppercase tracking-widest"
            style={{ color: colors.text, fontFamily: fonts.mono, letterSpacing: 0.06 }}
          >
            {call.name}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

export function ChatMessage({ item, compact }: { item: AiChatMessage; compact: boolean }) {
  const { colors } = useTheme()
  const accent = colors.weight ?? colors.primary

  if (item.role === "user") {
    return (
      <Box className={`mb-3 w-full flex-row justify-end ${compact ? "pl-6" : "pl-12"}`}>
        <Box
          className="max-w-full rounded-none border px-3.5 py-2.5"
          style={{
            backgroundColor: colors.primary,
            borderWidth: borders.width,
            borderColor: colors.primary,
            borderRadius: radii.none,
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
              {formatTimeHM(item.created_at)}
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
          // Violet carries the AI identity, matching the AI rail tab.
          backgroundColor: accent,
          borderWidth: borders.width,
          borderColor: colors.border,
          borderRadius: radii.none,
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
          borderWidth: borders.width,
          borderRadius: radii.none,
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
            <ActivityIndicator size="small" color={accent} />
            <Text
              size="sm"
              className="font-mono"
              style={{ fontFamily: fonts.mono, color: colors.textMuted }}
            >
              Thinking…
            </Text>
          </Box>
        ) : (
          <>
            <Markdown
              source={item.content || (item.is_error ? "The assistant ran into an error." : "")}
              bodySize="lg"
            />
            <ChatToolChips toolCalls={item.tool_calls} />
            {item.created_at ? (
              <Text
                size="xs"
                className="mt-1.5 font-mono tabular-nums"
                style={{ fontFamily: fonts.mono, color: colors.textMuted }}
              >
                {formatTimeHM(item.created_at)}
              </Text>
            ) : null}
          </>
        )}
      </Box>
    </Box>
  )
}

/**
 * Single message composer. One bordered box holds the field and the send
 * key, so the bar reads as one control. The border turns violet on focus;
 * the send key is solid violet when ready.
 */
export function ChatComposer({
  draft,
  setDraft,
  canSend,
  busy,
  configured,
  onSubmit,
  onStop,
  inputRef,
  bottomPad = 0,
}: {
  draft: string
  setDraft: (value: string) => void
  canSend: boolean
  busy: boolean
  configured: boolean
  onSubmit: () => void
  onStop: () => void
  inputRef?: RefObject<TextInput | null>
  /** Extra space under the bar for modal safe areas. */
  bottomPad?: number
}) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  const accent = colors.weight ?? colors.primary
  return (
    <Box
      className="px-3 pt-2"
      style={{
        paddingBottom: 12 + bottomPad,
        backgroundColor: "transparent",
      }}
    >
      <Box
        className="flex-row items-end"
        style={{
          gap: 8,
          backgroundColor: configured ? "transparent" : colors.surfaceAlt,
          borderWidth: borders.width,
          borderColor: focused && configured ? accent : colors.border,
          borderRadius: radii.none,
          padding: 6,
          paddingLeft: 12,
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
          style={[styles.input, { flex: 1, color: colors.text, fontFamily: fonts.mono }]}
          selectionColor={accent}
          accessibilityLabel="Message the AI assistant"
          returnKeyType="send"
          enterKeyHint="send"
          blurOnSubmit={false}
          onSubmitEditing={canSend ? onSubmit : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {busy ? (
          <Pressable
            onPress={onStop}
            accessibilityRole="button"
            accessibilityLabel="Stop generating"
            className="shrink-0 cursor-pointer items-center justify-center rounded-none border active:opacity-80"
            style={{
              width: 44,
              height: 44,
              borderWidth: borders.width,
              borderColor: colors.danger,
              borderRadius: radii.none,
              backgroundColor: withAlpha(colors.danger, 0.12),
            }}
          >
            <Feather name="square" size={16} color={colors.danger} />
          </Pressable>
        ) : (
          <Pressable
            onPress={onSubmit}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            className="shrink-0 cursor-pointer items-center justify-center rounded-none border active:opacity-80"
            style={{
              width: 44,
              height: 44,
              backgroundColor: canSend ? accent : "transparent",
              borderWidth: borders.width,
              borderColor: canSend ? accent : colors.border,
              borderRadius: radii.none,
            }}
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
  )
}

const styles = StyleSheet.create({
  input: {
    fontSize: 14,
    lineHeight: 20,
    maxHeight: 110,
    paddingTop: Platform.select({ ios: 10, android: 8, default: 11 }),
    paddingBottom: Platform.select({ ios: 10, android: 8, default: 11 }),
    paddingHorizontal: 0,
    fontFamily: fonts.mono,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
})
