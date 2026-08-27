import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { GitHubRelease } from "@/services/updates"
import { getApkAsset } from "@/services/updates"
import { Markdown } from "@/components/Markdown"
import { useEscapeToClose } from "@/hooks/useEscapeToClose"
import { useTheme } from "@/hooks/useTheme"
import { spacing, fonts } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Button, ButtonSpinner, ButtonText } from "@ui/button"

type Props = {
  release: GitHubRelease
  currentVersion: string
  downloading?: boolean
  downloadProgress?: number | null
  onClose: () => void
  onNeverAsk: () => void
  onDownload: () => void
}

const RELEASE_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

function formatReleaseDate(publishedAt: string | null): string {
  if (!publishedAt) return ""
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return ""
  return `${RELEASE_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

export function UpdateDialog({
  release,
  currentVersion,
  downloading = false,
  downloadProgress = null,
  onClose,
  onNeverAsk,
  onDownload,
}: Props) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const apk = getApkAsset(release)
  const published = formatReleaseDate(release.publishedAt)

  useEscapeToClose(true, onClose)

  const progressLabel = downloading
    ? downloadProgress !== null
      ? `Downloading ${Math.round(downloadProgress * 100)}%`
      : "Downloading\u2026"
    : "Download"

  // Keep the whole dialog inside the safe viewport. Outer 16px margin plus
  // the device insets guarantees the 1.5px ink rule never clips behind a
  // notch, gesture bar, or status bar, and the 45vh-class is replaced with
  // a real pixel cap so the header and footer stay visible on 5-inch phones.
  const effectiveHeight = windowHeight > 100 ? windowHeight : 800
  const dialogMaxHeight = Math.min(effectiveHeight - insets.top - insets.bottom - 24, 640)
  const scrollMaxHeight = Math.min(effectiveHeight * 0.38, 320)

  return (
    <Modal
      visible
      transparent
      animationType={Platform.OS === "web" ? "none" : "fade"}
      onRequestClose={onClose}
      {...(Platform.OS === "android"
        ? { statusBarTranslucent: true, hardwareAccelerated: true }
        : {})}
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.45)" }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss update dialog"
        />
        <View
          accessibilityViewIsModal={true}
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingTop: Math.max(insets.top, 12) + 8,
            paddingBottom: Math.max(insets.bottom, 12) + 8,
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
            pointerEvents: "box-none" as const,
          }}
        >
          <Box
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: dialogMaxHeight,
              backgroundColor: colors.surface,
              borderWidth: 1.5,
              borderColor: colors.border,
              overflow: "hidden",
              flexShrink: 1,
              boxShadow: "none",
              elevation: 0,
            }}
          >
            <Box
              className="flex-row items-center gap-3 px-5 pb-3"
              style={{ paddingTop: spacing.lg }}
            >
              <Box
                className="h-11 w-11 items-center justify-center bg-primary-500/15"
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderRadius: 0,
                  backgroundColor: `${colors.primary}14`,
                  boxShadow: "none",
                  elevation: 0,
                }}
              >
                <Feather name="download" size={22} color={colors.primary} />
              </Box>
              <Box className="min-w-0 flex-1">
                <Text
                  size="xl"
                  bold
                  className="text-typography-900"
                  style={{
                    fontFamily: fonts.mono,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  Update available
                </Text>
                <Text
                  size="xs"
                  className="mt-0.5 text-typography-500"
                  style={{
                    fontFamily: fonts.mono,
                    fontVariant: ["tabular-nums"],
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  {currentVersion} to {release.tag}
                  {published ? `, ${published}` : ""}
                </Text>
              </Box>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                className="p-1"
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderRadius: 0,
                  backgroundColor: colors.surfaceAlt,
                  width: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "none",
                  elevation: 0,
                }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Feather name="x" size={18} color={colors.textMuted} />
              </Pressable>
            </Box>

            <ScrollView
              style={{ maxHeight: scrollMaxHeight, flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
              showsVerticalScrollIndicator
            >
              <Text
                size="sm"
                className="mb-3 leading-[20px] text-typography-500"
                style={{ fontFamily: fonts.mono, letterSpacing: 0.2 }}
              >
                A new version of Dietinator is ready. Your diary, meals and settings stay on this
                device. Updating never touches your data.
              </Text>

              {release.notes?.trim() ? (
                <>
                  <Text
                    size="xs"
                    bold
                    className="mb-2 uppercase tracking-wide text-typography-500"
                    style={{
                      fontFamily: fonts.mono,
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                    }}
                  >
                    What&apos;s new
                  </Text>
                  <Markdown source={release.notes} />
                </>
              ) : (
                <Text size="sm" className="text-typography-500" style={{ fontFamily: fonts.mono }}>
                  No release notes published for this version.
                </Text>
              )}

              {!apk ? (
                <Text
                  size="sm"
                  className="mt-3 text-typography-500"
                  style={{ fontFamily: fonts.mono }}
                >
                  This release has no Android APK attached yet.
                </Text>
              ) : null}
            </ScrollView>

            <Box
              className="gap-2.5 px-5 py-4"
              style={{
                borderTopWidth: 1.5,
                borderTopColor: colors.border,
              }}
            >
              <Box className="flex-row items-center gap-3">
                <Button
                  size="md"
                  variant="outline"
                  action="secondary"
                  className="min-w-0 flex-1"
                  onPress={onClose}
                  isDisabled={downloading}
                  style={{ borderRadius: 0, borderWidth: 1.5, borderColor: colors.border }}
                >
                  <ButtonText
                    numberOfLines={1}
                    style={{
                      fontFamily: fonts.mono,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                    }}
                  >
                    Later
                  </ButtonText>
                </Button>
                {apk ? (
                  <Button
                    size="md"
                    className="min-w-0 flex-1"
                    onPress={onDownload}
                    isDisabled={downloading}
                    style={{
                      borderRadius: 0,
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                      boxShadow: "none",
                      elevation: 0,
                      minWidth: 0,
                      flexShrink: 1,
                    }}
                  >
                    {downloading ? <ButtonSpinner style={{ flexShrink: 0 }} /> : null}
                    <ButtonText
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                      style={{
                        fontFamily: fonts.mono,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        flexShrink: 1,
                      }}
                    >
                      {progressLabel}
                    </ButtonText>
                  </Button>
                ) : null}
              </Box>

              <Pressable
                onPress={onNeverAsk}
                hitSlop={8}
                disabled={downloading}
                className="items-center justify-center py-1"
                style={[]}
                accessibilityRole="button"
                accessibilityLabel="Don't ask again"
              >
                <Text
                  size="xs"
                  bold
                  className={`${downloading ? "opacity-40" : ""} text-typography-400`}
                  style={{
                    fontFamily: fonts.mono,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  Don&apos;t ask again
                </Text>
              </Pressable>
            </Box>
          </Box>
        </View>
      </View>
    </Modal>
  )
}
