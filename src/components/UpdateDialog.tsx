import { Pressable, ScrollView, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { GitHubRelease } from "@/services/updates"
import { getApkAsset } from "@/services/updates"
import { Markdown } from "@/components/Markdown"
import { ModalContainer } from "@/components/ModalContainer"
import { useTheme } from "@/hooks/useTheme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Button, ButtonText } from "@ui/button"

type Props = {
  release: GitHubRelease
  currentVersion: string
  onClose: () => void
  onNeverAsk: () => void
  onDownload: () => void
}

function formatReleaseDate(publishedAt: string | null): string {
  if (!publishedAt) return ""
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * Full-screen modal announcing a newer release. Renders the release changelog
 * as markdown; on Android the primary action opens the signed APK download.
 */
export function UpdateDialog({ release, currentVersion, onClose, onNeverAsk, onDownload }: Props) {
  const { colors } = useTheme()
  const apk = getApkAsset(release)
  const published = formatReleaseDate(release.publishedAt)

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9998,
      }}
    >
      <ModalContainer maxWidth={560}>
        <Box className="flex-row items-center gap-3 px-5 pb-3 pt-5">
          <Box className="h-11 w-11 items-center justify-center rounded-full bg-primary-500/15">
            <Ionicons name="download-outline" size={24} color={colors.primary} />
          </Box>
          <Box className="min-w-0 flex-1">
            <Text size="xl" bold className="text-typography-900">
              Update available
            </Text>
            <Text size="xs" className="mt-0.5 text-typography-500">
              {currentVersion} → {release.tag}
              {published ? ` · ${published}` : ""}
            </Text>
          </Box>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            className="p-1"
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </Box>

        <ScrollView
          className="max-h-[45vh]"
          contentContainerClassName="px-5 pb-3"
          showsVerticalScrollIndicator
        >
          <Text size="sm" className="mb-3 leading-[20px] text-typography-500">
            A new version of Dietinator is ready. Your diary, meals and settings stay on this device
            — updating never touches your data.
          </Text>

          {release.notes?.trim() ? (
            <>
              <Text size="xs" bold className="mb-2 uppercase tracking-wide text-typography-500">
                What's new
              </Text>
              <Markdown source={release.notes} />
            </>
          ) : (
            <Text size="sm" className="text-typography-500">
              No release notes published for this version.
            </Text>
          )}

          {!apk ? (
            <Text size="sm" className="mt-3 text-typography-500">
              This release has no Android APK attached yet.
            </Text>
          ) : null}
        </ScrollView>

        <Box className="flex-row items-center gap-3 border-t border-outline-100 px-5 py-4">
          <Pressable
            onPress={onNeverAsk}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Don't ask again"
          >
            <Text size="sm" bold className="text-typography-500">
              Don't ask again
            </Text>
          </Pressable>
          <View className="flex-1" />
          <Button size="md" variant="outline" action="secondary" onPress={onClose}>
            <ButtonText>Later</ButtonText>
          </Button>
          {apk ? (
            <Button size="md" onPress={onDownload}>
              <ButtonText>Download</ButtonText>
            </Button>
          ) : null}
        </Box>
      </ModalContainer>
    </View>
  )
}
