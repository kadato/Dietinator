"use client"
import React from "react"
import { Pressable, View } from "react-native"
import { tva } from "@gluestack-ui/utils/nativewind-utils"
import type { VariantProps } from "@gluestack-ui/utils/nativewind-utils"

/**
 * Field-terminal toggle. The No Pill Rule bans the capsule switch, so this
 * is a square track with a square thumb that snaps between wells: off reads
 * as an empty well, on inverts to ink fill with a paper thumb. Keeps the
 * RN Switch prop contract (`value` / `onValueChange` / `isDisabled`) so
 * call sites stay unchanged.
 */

const switchStyle = tva({
  base: "web:cursor-pointer data-[disabled=true]:opacity-40",
  variants: {
    size: {
      sm: "scale-75",
      md: "",
      lg: "scale-125",
    },
  },
})

type SquareSwitchProps = {
  value?: boolean
  onValueChange?: (value: boolean) => void
  isDisabled?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  size?: VariantProps<typeof switchStyle>["size"]
  className?: string
}

const TRACK_W = 46
const TRACK_H = 26
const THUMB = 18

function SquareSwitchImpl(
  {
    value = false,
    onValueChange,
    isDisabled = false,
    disabled = false,
    accessibilityLabel,
    size = "md",
    className,
  }: SquareSwitchProps,
  ref: React.Ref<React.ComponentRef<typeof Pressable>>,
) {
  const off = isDisabled || disabled
  // 1.5px rules each side + centered inset leave the travel distance.
  const travel = TRACK_W - THUMB - 7

  return (
    <Pressable
      ref={ref}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: off }}
      accessibilityLabel={accessibilityLabel}
      disabled={off}
      onPress={() => onValueChange?.(!value)}
      className={switchStyle({ size, class: className })}
    >
      <View
        style={{
          width: TRACK_W,
          height: TRACK_H,
          alignItems: "flex-start",
          justifyContent: "center",
          borderWidth: 1.5,
          borderRadius: 0,
          padding: 2,
        }}
        className={
          value ? "border-primary-500 bg-primary-500" : "border-outline-300 bg-background-100"
        }
      >
        <View
          style={{
            width: THUMB,
            height: THUMB - 1,
            borderRadius: 0,
            transform: [{ translateX: value ? travel : 0 }],
          }}
          className={value ? "bg-typography-white" : "bg-outline-300"}
        />
      </View>
    </Pressable>
  )
}

export const Switch = React.forwardRef(SquareSwitchImpl)
