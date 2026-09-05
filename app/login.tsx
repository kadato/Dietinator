import { useEffect, useRef, useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { loginWithCredentials } from "@/services/yazio/client"
import {
  clearRememberedLogin,
  getRememberedLogin,
  saveRememberedLogin,
} from "@/services/yazio/auth-storage"
import { importFromYazio } from "@/services/yazio/sync"
import { isDemoQuery, seedDemoSession } from "@/services/demo"
import { toDateKey } from "@/utils/date"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/context/ToastContext"
import { useTheme } from "@/hooks/useTheme"
import { usePressedState } from "@/hooks/usePressedState"
import { useLayout } from "@/hooks/useLayout"
import { PageContainer } from "@/components/PageContainer"
import { withAlpha } from "@/utils/color"
import { fonts, borders, radii } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Input, InputField } from "@ui/input"
import { Button, ButtonSpinner, ButtonText } from "@ui/button"
import { Switch } from "@ui/switch"
import { Card } from "@ui/card"

export default function LoginScreen() {
  const router = useRouter()
  const { refreshAuth, refreshSettings } = useApp()
  const { showError, showWarning } = useToast()
  const { colors } = useTheme()
  const { isWide } = useLayout()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [googleHelpExpanded, setGoogleHelpExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const togglePress = usePressedState()
  const passwordRef = useRef<TextInput>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (isDemoQuery()) {
        await seedDemoSession()
        await refreshSettings()
        await refreshAuth()
        if (!cancelled) router.replace("/(tabs)")
        return
      }
      const remembered = await getRememberedLogin()
      if (cancelled || !remembered) return
      setEmail(remembered.email)
      setPassword(remembered.password)
      setRememberMe(true)
    })()
    return () => {
      cancelled = true
    }
  }, [refreshAuth, refreshSettings, router])

  const handleLogin = async () => {
    if (loading) return
    if (!email.trim() || !password) {
      showWarning("Enter your YAZIO email and password.", "Missing fields")
      return
    }
    setLoading(true)
    try {
      await loginWithCredentials(email.trim(), password)
      if (rememberMe) {
        await saveRememberedLogin(email.trim(), password)
      } else {
        await clearRememberedLogin()
      }
      await importFromYazio(toDateKey())
      await refreshSettings()
      await refreshAuth()
      router.replace("/(tabs)")
    } catch (error) {
      showError(error, "Check your YAZIO credentials.", "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const safeTop = insets.top > 0 ? insets.top : Platform.OS === "android" ? 24 : 0
  const safeBottom = insets.bottom

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: "transparent" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={safeTop}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <PageContainer
          variant={isWide ? "wide" : "narrow"}
          contentClassName="px-6 justify-center"
          contentStyle={[
            { paddingTop: safeTop + 24, paddingBottom: safeBottom + 24 },
            isWide ? { maxWidth: 720, alignSelf: "center", width: "100%" } : undefined,
          ]}
        >
          {isWide ? (
            <Box className="mb-8 w-full max-w-[640px] flex-row items-center gap-6 self-center">
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderWidth: borders.width,
                  borderColor: colors.primary,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                accessibilityLabel="Dietinator app icon"
              >
                <Text
                  style={{
                    color: colors.onPrimary,
                    fontFamily: "Departure Mono",
                    fontSize: 44,
                    lineHeight: 44,
                    fontWeight: "700",
                    textAlign: "center",
                  }}
                >
                  D
                </Text>
              </View>
              <Box className="flex-1 gap-2">
                <Text
                  size="4xl"
                  bold
                  accessibilityRole="header"
                  className="uppercase tracking-widest"
                  style={{ color: colors.text, fontFamily: fonts.mono, letterSpacing: 0.06 }}
                >
                  Dietinator
                </Text>
                <Text
                  size="xs"
                  bold
                  className="font-mono uppercase tracking-widest"
                  style={{ color: colors.textMuted, letterSpacing: 0.08, fontFamily: fonts.mono }}
                >
                  Track calories. No ads. Offline first.
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 8,
                  }}
                >
                  {[
                    { k: "OFFLINE", v: "SQLite first" },
                    { k: "GRID", v: "24px ruled" },
                    { k: "MONO", v: "Departure 11px" },
                  ].map((chip) => (
                    <Box
                      key={chip.k}
                      className="flex-row items-center gap-1.5 rounded-none border px-2.5 py-1.5"
                      style={{
                        borderWidth: borders.widthThin,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <Text
                        size="2xs"
                        bold
                        style={{
                          color: colors.primary,
                          fontFamily: fonts.mono,
                          letterSpacing: 0.06,
                        }}
                      >
                        {chip.k}
                      </Text>
                      <Text size="2xs" style={{ color: colors.textMuted, fontFamily: fonts.mono }}>
                        {chip.v}
                      </Text>
                    </Box>
                  ))}
                </View>
              </Box>
            </Box>
          ) : null}
          <Box className={`${isWide ? "mx-auto w-full max-w-[440px]" : ""} mb-8 items-center`}>
            {isWide ? null : (
              <View
                style={{
                  width: 80,
                  height: 80,
                  marginBottom: 20,
                  borderWidth: borders.width,
                  borderColor: colors.primary,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                accessibilityLabel="Dietinator app icon"
              >
                <Text
                  style={{
                    color: colors.onPrimary,
                    fontFamily: "Departure Mono",
                    fontSize: 33,
                    lineHeight: 33,
                    fontWeight: "700",
                    textAlign: "center",
                  }}
                >
                  D
                </Text>
              </View>
            )}
            <Text
              size={isWide ? "xl" : "3xl"}
              bold
              accessibilityRole="header"
              className={`${isWide ? "hidden" : ""} text-center uppercase tracking-widest`}
              style={{ fontFamily: fonts.mono, letterSpacing: 0.06, color: colors.text }}
            >
              {isWide ? "Sign in" : "Dietinator"}
            </Text>
            <Text
              size="xs"
              bold
              className={`${isWide ? "hidden" : ""} mt-2 max-w-[340px] text-center font-mono uppercase tracking-widest`}
              style={{ letterSpacing: 0.08, color: colors.textMuted }}
            >
              Track calories. No ads.
            </Text>
            {isWide ? (
              <Text
                size="xs"
                bold
                className="mt-2 text-center font-mono uppercase tracking-widest"
                style={{ color: colors.textMuted, letterSpacing: 0.08, fontFamily: fonts.mono }}
              >
                Sign in with YAZIO or try the demo
              </Text>
            ) : null}
          </Box>

          <Box className={isWide ? "mx-auto w-full max-w-[440px]" : ""}>
            <Card
              variant="elevated"
              className="gap-4 p-5"
              style={{
                borderWidth: borders.width,
                borderColor: colors.border,
                borderRadius: radii.none,
                backgroundColor: colors.surface,
                boxShadow: "none",
                elevation: 0,
              }}
            >
              <Input
                size="lg"
                variant="outline"
                isDisabled={loading}
                className="rounded-none border"
                style={{
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  borderRadius: radii.none,
                }}
              >
                <InputField
                  placeholder="YAZIO email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="username"
                  autoComplete="email"
                  returnKeyType="next"
                  enterKeyHint="next"
                  blurOnSubmit={false}
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  style={{ fontFamily: fonts.mono }}
                />
              </Input>

              <Input
                size="lg"
                variant="outline"
                isDisabled={loading}
                className="rounded-none border"
                style={{
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  borderRadius: radii.none,
                }}
              >
                <InputField
                  ref={passwordRef as never}
                  placeholder="Password"
                  secureTextEntry={!passwordVisible}
                  textContentType="password"
                  autoComplete="password"
                  returnKeyType="go"
                  enterKeyHint="go"
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={handleLogin}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{ fontFamily: fonts.mono }}
                />
                <Pressable
                  onPress={() => setPasswordVisible((visible) => !visible)}
                  onPressIn={togglePress.onPressIn}
                  onPressOut={togglePress.onPressOut}
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                  accessibilityState={{ selected: passwordVisible }}
                  hitSlop={8}
                  className="mr-1.5 h-8 w-8 items-center justify-center rounded-none border"
                  style={[
                    {
                      borderWidth: borders.width,
                      borderColor: passwordVisible ? colors.primary : colors.border,
                      backgroundColor: passwordVisible
                        ? withAlpha(colors.primary, 0.14)
                        : "transparent",
                      opacity: togglePress.pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Feather
                    name={passwordVisible ? "eye-off" : "eye"}
                    size={16}
                    color={passwordVisible ? colors.primary : colors.textMuted}
                  />
                </Pressable>
              </Input>

              <Box className="flex-row items-center justify-between">
                <Text
                  size="sm"
                  bold
                  className="font-mono uppercase tracking-widest"
                  style={{ color: colors.text, fontFamily: fonts.mono, letterSpacing: 0.04 }}
                >
                  Remember me
                </Text>
                <Switch
                  value={rememberMe}
                  onValueChange={setRememberMe}
                  isDisabled={loading || demoLoading}
                  accessibilityLabel="Remember me"
                />
              </Box>

              <Button
                size="lg"
                onPress={handleLogin}
                isDisabled={loading || demoLoading}
                className="mt-1 rounded-none border"
                style={{
                  borderWidth: borders.width,
                  borderColor: colors.primary,
                  borderRadius: radii.none,
                  backgroundColor: colors.primary,
                }}
              >
                {loading ? (
                  <ButtonSpinner color={colors.onPrimary} />
                ) : (
                  <ButtonText
                    style={{
                      fontFamily: fonts.mono,
                      textTransform: "uppercase",
                      letterSpacing: 0.06,
                      color: colors.onPrimary,
                    }}
                  >
                    Sign in
                  </ButtonText>
                )}
              </Button>

              <Button
                size="lg"
                variant="outline"
                action="secondary"
                isDisabled={loading || demoLoading}
                className="rounded-none border"
                style={{
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  borderRadius: radii.none,
                  backgroundColor: colors.surface,
                }}
                onPress={async () => {
                  setDemoLoading(true)
                  try {
                    await seedDemoSession()
                    await refreshSettings()
                    await refreshAuth()
                    router.replace("/(tabs)")
                  } catch (error) {
                    showError(error, "Could not start the demo.")
                  } finally {
                    setDemoLoading(false)
                  }
                }}
              >
                {demoLoading ? (
                  <ButtonSpinner color={colors.primary} />
                ) : (
                  <ButtonText
                    style={{
                      fontFamily: fonts.mono,
                      textTransform: "uppercase",
                      letterSpacing: 0.06,
                    }}
                  >
                    Try the demo
                  </ButtonText>
                )}
              </Button>
            </Card>

            <Card
              variant="elevated"
              className="mt-4 p-0"
              style={{
                borderWidth: borders.width,
                borderColor: colors.border,
                borderRadius: radii.none,
                backgroundColor: colors.surface,
                boxShadow: "none",
                elevation: 0,
              }}
            >
              <Pressable
                className="flex-row items-center justify-between gap-2 p-4 active:opacity-80"
                onPress={() => setGoogleHelpExpanded((expanded) => !expanded)}
                accessibilityRole="button"
                accessibilityState={{ expanded: googleHelpExpanded }}
                accessibilityLabel="Registered with Google? Show instructions"
              >
                <Box className="flex-1 flex-row items-center gap-2">
                  <Feather name="help-circle" size={18} color={colors.textMuted} />
                  <Text
                    size="sm"
                    bold
                    className="flex-1 font-mono uppercase tracking-widest"
                    style={{ color: colors.text, fontFamily: fonts.mono, letterSpacing: 0.04 }}
                  >
                    Registered with Google?
                  </Text>
                </Box>
                <Feather
                  name={googleHelpExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
              {googleHelpExpanded ? (
                <Text
                  size="sm"
                  className="mt-1 px-4 pb-4 leading-5"
                  style={{ color: colors.textMuted, fontFamily: fonts.mono }}
                >
                  In the YAZIO app: sign out, select email login, tap &apos;Forgot password&apos;,
                  and set a password. Sign in here with it.
                </Text>
              ) : null}
            </Card>

            <Text
              size="xs"
              className="mt-8 px-2 text-center font-mono uppercase tracking-widest"
              style={{ color: colors.textMuted, fontFamily: fonts.mono, letterSpacing: 0.06 }}
            >
              Unofficial YAZIO API. For personal use only. Credentials are stored securely on this
              device.
            </Text>
          </Box>
        </PageContainer>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
