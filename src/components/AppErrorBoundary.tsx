import React from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { lightColors, spacing } from "@/theme"

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

    return (
      <View style={styles.container}>
        <Ionicons name="warning-outline" size={48} color={lightColors.danger} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: lightColors.background,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: lightColors.text,
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    color: lightColors.textMuted,
  },
  details: {
    maxHeight: 160,
    alignSelf: "stretch",
    marginVertical: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: lightColors.surface,
  },
  detailText: {
    fontSize: 12,
    color: lightColors.textMuted,
  },
  button: {
    backgroundColor: lightColors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 8,
  },
  buttonText: {
    color: lightColors.onPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
})
