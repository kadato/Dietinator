import { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loginWithCredentials } from '@/services/yazio/client';
import { loadGoalsFromYazio } from '@/services/yazio/sync';
import { useApp } from '@/context/AppContext';
import { colors, spacing } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { refreshAuth } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [googleHelpExpanded, setGoogleHelpExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter your YAZIO email and password.');
      return;
    }
    setLoading(true);
    try {
      await loginWithCredentials(email.trim(), password);
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
        value={email}
        onChangeText={setEmail}
      />
      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!passwordVisible}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
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

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>Sign in with YAZIO</Text>
        )}
      </Pressable>

      <Text style={styles.disclaimer}>
        Uses an unofficial YAZIO API. For personal use only. Your password is stored
        securely on this device.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.background,
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
