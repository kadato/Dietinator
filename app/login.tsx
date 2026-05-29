import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loginWithCredentials } from '@/services/yazio/client';
import {
  clearRememberedLogin,
  getRememberedLogin,
  saveRememberedLogin,
} from '@/services/yazio/auth-storage';
import { loadGoalsFromYazio } from '@/services/yazio/sync';
import { useApp } from '@/context/AppContext';
import { PageContainer } from '@/components/PageContainer';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { refreshAuth } = useApp();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [googleHelpExpanded, setGoogleHelpExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remembered = await getRememberedLogin();
      if (cancelled || !remembered) return;
      setEmail(remembered.email);
      setPassword(remembered.password);
      setRememberMe(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async () => {
    if (loading) return;
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter your YAZIO email and password.');
      return;
    }
    setLoading(true);
    try {
      await loginWithCredentials(email.trim(), password);
      if (rememberMe) {
        await saveRememberedLogin(email.trim(), password);
      } else {
        await clearRememberedLogin();
      }
      await loadGoalsFromYazio();
      await refreshAuth();
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert(
        'Login failed',
        error instanceof Error ? error.message : 'Check your YAZIO credentials.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <PageContainer variant="narrow" contentStyle={styles.form}>
      <Text style={styles.title}>Dietinator</Text>
      <Text style={styles.subtitle}>
        Fast, ad-free logging using your YAZIO account and food database.
      </Text>

      <View style={styles.googleHelp}>
        <Pressable
          style={styles.googleHelpHeader}
          onPress={() => setGoogleHelpExpanded((expanded) => !expanded)}
          accessibilityRole="button"
          accessibilityState={{ expanded: googleHelpExpanded }}
          accessibilityLabel="Registered with Google? Show instructions"
        >
          <Text style={styles.googleHelpTitle}>Registered with Google?</Text>
          <Ionicons
            name={googleHelpExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </Pressable>
        {googleHelpExpanded ? (
          <Text style={styles.googleHelpText}>
            This app signs in with your YAZIO email and password, not Google directly.
            In the official YAZIO app: sign out, log in with email (use the same address
            as your Google account), tap Forgot password, and set a new password. Then
            sign in here with that email and password.
          </Text>
        ) : null}
      </View>

      <TextInput
        style={styles.input}
        placeholder="YAZIO email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="username"
        autoComplete="email"
        returnKeyType="next"
        blurOnSubmit={false}
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!loading}
      />
      <View style={styles.passwordRow}>
        <TextInput
          ref={passwordRef}
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!passwordVisible}
          textContentType="password"
          autoComplete="password"
          returnKeyType="go"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        <Pressable
          style={styles.passwordToggle}
          onPress={() => setPasswordVisible((visible) => !visible)}
          accessibilityRole="button"
          accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
        >
          <Ionicons
            name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={colors.textMuted}
          />
        </Pressable>
      </View>

      <View style={styles.rememberRow}>
        <Text style={styles.rememberLabel}>Remember me</Text>
        <Switch
          value={rememberMe}
          onValueChange={setRememberMe}
          trackColor={{ true: colors.primary }}
          disabled={loading}
        />
      </View>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Sign in with YAZIO</Text>
        )}
      </Pressable>

      <Text style={styles.disclaimer}>
        Uses an unofficial YAZIO API. For personal use only. With Remember me, your
        sign-in details are stored securely on this device for the next visit.
      </Text>
      </PageContainer>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  form: {
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  googleHelp: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleHelpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  googleHelpTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  googleHelpText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordInput: {
    flex: 1,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  passwordToggle: {
    padding: spacing.md,
    paddingLeft: 0,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rememberLabel: {
    fontSize: 15,
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    marginTop: spacing.xl,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    textAlign: 'center',
  },
});
