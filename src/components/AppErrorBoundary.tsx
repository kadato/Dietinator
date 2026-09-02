import React from "react"
import { Appearance, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { darkColors, lightColors, spacing, fonts, type ColorPalette, borders, radii } from "@/theme"

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
 * context; it follows the system color scheme instead.
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
        <View style={styles.iconWrap}>
          <Feather name="alert-triangle" size={32} color={colors.danger} />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          Your diary is safe. Data lives on this device and nothing was lost.
        </Text>
        <ScrollView style={styles.details}>
          <Text style={styles.detailText}>{String(this.state.error.message)}</Text>
        </ScrollView>
        <Pressable style={[styles.button]} onPress={this.handleReload} accessibilityRole="button">
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
    iconWrap: {
      width: 56,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: borders.width,
      borderColor: colors.border,
      borderRadius: radii.none,
      backgroundColor: colors.surface,
      boxShadow: "none",
      elevation: 0,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
      textAlign: "center",
    },
    message: {
      fontSize: 14,
      textAlign: "center",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
      lineHeight: 18,
    },
    details: {
      maxHeight: 160,
      alignSelf: "stretch",
      marginVertical: spacing.sm,
      padding: spacing.sm,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      boxShadow: "none",
      elevation: 0,
    },
    detailText: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      letterSpacing: 0.2,
    },
    button: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.primary,
      boxShadow: "none",
      elevation: 0,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
  })
