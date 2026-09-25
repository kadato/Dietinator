import { Pressable, ScrollView, View } from "react-native"
import { useRouter } from "expo-router"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { PageContainer } from "@/components/PageContainer"
import { useTheme } from "@/hooks/useTheme"
import { borders, fonts, radii } from "@/theme"

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "What stays on this device",
    body: "Diary entries, goals, and food cache live in SQLite on this device. Exports to JSON or CSV happen only when you tap export.",
  },
  {
    heading: "YAZIO login",
    body: "If you sign in, the app stores your YAZIO email, API tokens, and password when you select remember me. The app stores secrets with expo-secure-store on native and with prefixed localStorage on web. The web fallback is weaker than the native keystore. Tokens go to YAZIO through a same-origin proxy and never to another third party.",
  },
  {
    heading: "What is not collected",
    body: "No analytics SDKs. No ads. No crash reporters. No cookies. No tracking across sites.",
  },
  {
    heading: "Retention and deletion",
    body: "Data stays until you delete it. Sign out clears tokens. You remove diary data when you delete entries or clear app storage.",
  },
  {
    heading: "Your rights",
    body: "This is a personal tracker. To inspect data, open Settings and use export. To delete data, delete entries or reinstall.",
  },
]

export default function PrivacyScreen() {
  const router = useRouter()
  const { colors } = useTheme()

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "transparent" }}>
      <PageContainer variant="narrow" contentClassName="px-6 py-8">
        <Text
          accessibilityRole="header"
          style={{
            color: colors.text,
            fontFamily: fonts.mono,
            fontSize: 24,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.06,
          }}
        >
          Privacy
        </Text>
        <Text
          style={{ color: colors.textMuted, fontFamily: fonts.mono, fontSize: 12, marginTop: 8 }}
        >
          Last updated 2026-09-25. The tracker stores data on the device and sends no analytics.
        </Text>
        {SECTIONS.map((section) => (
          <View
            key={section.heading}
            style={{
              marginTop: 16,
              borderWidth: borders.width,
              borderColor: colors.border,
              borderRadius: radii.none,
              backgroundColor: colors.surface,
              padding: 16,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                color: colors.text,
                fontFamily: fonts.mono,
                fontSize: 14,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.04,
              }}
            >
              {section.heading}
            </Text>
            <Text
              style={{
                color: colors.text,
                fontFamily: fonts.mono,
                fontSize: 14,
                lineHeight: 20,
                marginTop: 8,
              }}
            >
              {section.body}
            </Text>
          </View>
        ))}
        <Box className="mt-6">
          <Pressable
            onPress={() => router.replace("/")}
            accessibilityRole="button"
            accessibilityLabel="Back to tracker"
            style={{
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
              Back to tracker
            </Text>
          </Pressable>
        </Box>
      </PageContainer>
    </ScrollView>
  )
}
