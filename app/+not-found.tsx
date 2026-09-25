import { Pressable, View } from "react-native"
import { Link, useRouter } from "expo-router"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { PageContainer } from "@/components/PageContainer"
import { useTheme } from "@/hooks/useTheme"
import { borders, fonts } from "@/theme"

export default function NotFoundScreen() {
  const router = useRouter()
  const { colors } = useTheme()

  return (
    <PageContainer variant="narrow" contentClassName="px-6 justify-center flex-1">
      <View
        style={{
          borderWidth: borders.width,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: 24,
          gap: 12,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: colors.text,
            fontFamily: fonts.mono,
            fontSize: 22,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.06,
          }}
        >
          Page not found
        </Text>
        <Text
          style={{ color: colors.textMuted, fontFamily: fonts.mono, fontSize: 14, lineHeight: 20 }}
        >
          That address does not exist in this tracker. Your diary is safe.
        </Text>
        <Box className="mt-2 flex-row gap-3">
          <Pressable
            onPress={() => router.replace("/")}
            accessibilityRole="button"
            accessibilityLabel="Go home"
            style={{
              flex: 1,
              borderWidth: borders.width,
              borderColor: colors.primary,
              backgroundColor: colors.primary,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.onPrimary,
                fontFamily: fonts.mono,
                textTransform: "uppercase",
                letterSpacing: 0.06,
              }}
            >
              Go home
            </Text>
          </Pressable>
          <Link href="/login" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to sign in"
              style={{
                flex: 1,
                borderWidth: borders.width,
                borderColor: colors.border,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontFamily: fonts.mono,
                  textTransform: "uppercase",
                  letterSpacing: 0.06,
                }}
              >
                Sign in
              </Text>
            </Pressable>
          </Link>
        </Box>
      </View>
    </PageContainer>
  )
}
