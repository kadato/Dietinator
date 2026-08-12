import React from "react"
import { Appearance, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { darkColors, lightColors, spacing, type ColorPalette } from "@/theme"

type Props = {
  children: React.ReactNode
}

type State = {
  error: Error | null
}

/**
 * Last line of defense: an uncaught render error must show a recoverable
 * screen, never a dead white page. The diary is local-first, so reloading
 * never loses data.
 *
 * This boundary sits above ThemeProvider, so it cannot read the theme
 * context; it follows the system color scheme instead (the app's default
 * theme preference is "system").
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  private handleReload = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    const scheme = Appearance.getColorScheme() === "light" ? "light" : "dark"
    const colors = scheme === "light" ? lightColors : darkColors
    const styles = createStyles(colors)

    return (
      <View style={styles.container}>
        <Ionicons name="warning-outline" size={48} color={colors.danger} />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          Your diary is safe — data lives on this device and nothing was lost.
        </Text>
        <ScrollView style={styles.details}>
          <Text style={styles.detailText}>{String(this.state.error.message)}</Text>
        </ScrollView>
        <Pressable style={styles.button} onPress={this.handleReload} accessibilityRole="button">
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    )
  }
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    message: {
      fontSize: 15,
      textAlign: "center",
      color: colors.textMuted,
    },
    details: {
      maxHeight: 160,
      alignSelf: "stretch",
      marginVertical: spacing.sm,
      padding: spacing.sm,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    detailText: {
      fontSize: 12,
      color: colors.textMuted,
    },
    button: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      borderRadius: 24,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
  })
