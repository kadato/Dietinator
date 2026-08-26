import React, { useEffect } from "react"
import { config } from "./config"
import { View, ViewProps } from "react-native"
import { OverlayProvider } from "@gluestack-ui/core/overlay/creator"
import { ToastProvider } from "@gluestack-ui/core/toast/creator"
import { useColorScheme } from "nativewind"

export type ModeType = "light" | "dark" | "system"

export function GluestackUIProvider({
  mode = "light",
  ...props
}: {
  mode?: ModeType
  children?: React.ReactNode
  style?: ViewProps["style"]
}) {
  const { colorScheme, setColorScheme } = useColorScheme()

  useEffect(() => {
    setColorScheme(mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const vars =
    (config as Record<string, typeof config.light>)[mode] ?? config[colorScheme!] ?? config.light

  return (
    <View style={[vars, { flex: 1, height: "100%", width: "100%" }, props.style]}>
      <OverlayProvider>
        <ToastProvider>{props.children}</ToastProvider>
      </OverlayProvider>
    </View>
  )
}
