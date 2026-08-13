import { useEffect, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, TextInput } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
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
import { useLayout } from "@/hooks/useLayout"
import { PageContainer } from "@/components/PageContainer"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Input, InputField, InputSlot } from "@ui/input"
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
  const passwordRef = useRef<TextInput>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // ?demo=1 opens a ready-to-explore session without an account (web).
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

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background-0"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <PageContainer
        variant="narrow"
        contentClassName="px-6 justify-center"
        contentStyle={[
          // Top inset keeps the header clear of the status bar / camera hole
          // (edge-to-edge Android), including when the keyboard shifts content.
          { paddingTop: insets.top + 24, paddingBottom: 24 },
          isWide ? { maxWidth: 480 } : undefined,
        ]}
      >
        <Box className="mb-8 items-center">
          <Box className="bg-primary-500/12 mb-5 h-20 w-20 items-center justify-center rounded-3xl">
            <Ionicons name="leaf" size={40} color={colors.primary} />
          </Box>
          <Text size={isWide ? "4xl" : "3xl"} bold className="text-center text-typography-900">
            Dietinator
          </Text>
          <Text
            size="md"
            className="mt-2 max-w-[340px] text-center leading-[24px] text-typography-500"
          >
            Track calories. No ads.
          </Text>
        </Box>

        <Card variant="elevated" className="gap-4 border border-outline-100 p-5">
          <Input size="lg" variant="outline" isDisabled={loading}>
            <InputField
              placeholder="YAZIO email"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              returnKeyType="next"
              blurOnSubmit={false}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </Input>

          <Input size="lg" variant="outline" isDisabled={loading}>
            <InputField
              ref={passwordRef as never}
              placeholder="Password"
              secureTextEntry={!passwordVisible}
              textContentType="password"
              autoComplete="password"
              returnKeyType="go"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <InputSlot
              onPress={() => setPasswordVisible((visible) => !visible)}
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={colors.textMuted}
              />
            </InputSlot>
          </Input>

          <Box className="flex-row items-center justify-between">
            <Text size="md" className="text-typography-900">
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
            className="mt-1"
          >
            {loading ? (
              <ButtonSpinner color={colors.onPrimary} />
            ) : (
              <ButtonText>Sign in</ButtonText>
            )}
          </Button>

          <Button
            size="lg"
            variant="outline"
            action="secondary"
            isDisabled={loading || demoLoading}
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
              <ButtonText>Try the demo</ButtonText>
            )}
          </Button>
        </Card>

        <Card variant="elevated" className="mt-4 border border-outline-100">
          <Pressable
            className="flex-row items-center justify-between gap-2 p-4"
            onPress={() => setGoogleHelpExpanded((expanded) => !expanded)}
            accessibilityRole="button"
            accessibilityState={{ expanded: googleHelpExpanded }}
            accessibilityLabel="Registered with Google? Show instructions"
          >
            <Box className="flex-1 flex-row items-center gap-2">
              <Ionicons name="logo-google" size={18} color={colors.textMuted} />
              <Text size="sm" bold className="flex-1 text-typography-900">
                Registered with Google?
              </Text>
            </Box>
            <Ionicons
              name={googleHelpExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
          {googleHelpExpanded ? (
            <Text size="sm" className="mt-1 px-4 pb-4 leading-5 text-typography-500">
              In the YAZIO app: sign out, log in with email, tap Forgot password, set a new one.
              Sign in here with it.
            </Text>
          ) : null}
        </Card>

        <Text size="xs" className="mt-8 px-2 text-center leading-4 text-typography-500">
          Unofficial YAZIO API, personal use only. Login is stored securely on this device.
        </Text>
      </PageContainer>
    </KeyboardAvoidingView>
  )
}
