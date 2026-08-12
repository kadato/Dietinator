import { useMemo, useState } from "react"
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from "react-native"
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { parseDateKey, shiftDateKey } from "@/utils/date"
import { spacing, type ColorPalette } from "@/theme"

export type TrendPoint = { date: string; value: number }

type Props = {
  data: TrendPoint[]
  color: string
  /** Optional horizontal dashed target line (e.g. the calorie goal). */
  goalValue?: number
  /** "line" draws a connected line; "bars" draws one bar per point. */
  variant?: "line" | "bars"
  /** Inclusive range (YYYY-MM-DD) the x axis spans. Points are positioned by
      their date, so sparse data stays truthful and the axis changes with the
      selected time range. */
  rangeStart: string
  rangeEnd: string
  formatValue: (value: number) => string
  formatDate: (dateKey: string) => string
  height?: number
  accessibilityLabel: string
  /** Called with the data point nearest to a tap on the chart. */
  onPointPress?: (point: TrendPoint) => void
}

const PAD = { top: 14, right: 12, bottom: 24, left: 46 }
const DAY_MS = 86400000

function dayIndex(dateKey: string, startKey: string): number {
  // Rounded so DST 23/25h days still map to a whole day.
  return Math.round((parseDateKey(dateKey).getTime() - parseDateKey(startKey).getTime()) / DAY_MS)
}

/**
 * Lightweight SVG trend chart. No chart library — just react-native-svg,
 * which is already a dependency and renders on native and web.
 *
 * The bar variant shades bars over the goal in the danger color, so a glance
 * shows which days went over budget.
 */
export function TrendChart({
  data,
  color,
  goalValue,
  variant = "line",
  rangeStart,
  rangeEnd,
  formatValue,
  formatDate,
  height = 180,
  accessibilityLabel,
  onPointPress,
}: Props) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const [width, setWidth] = useState(0)

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width)
  }

  const geometry = useMemo(() => {
    if (data.length === 0 || width === 0) return null
    const innerW = width - PAD.left - PAD.right
    const innerH = height - PAD.top - PAD.bottom
    const totalDays = Math.max(dayIndex(rangeEnd, rangeStart) + 1, 1)

    const values = data.map((point) => point.value)
    let min = Math.min(...values)
    let max = Math.max(...values)
    if (goalValue !== undefined) {
      min = Math.min(min, goalValue)
      max = Math.max(max, goalValue)
    }
    const span = max - min
    if (span === 0) {
      const pad = Math.max(Math.abs(max) * 0.05, 1)
      min -= pad
      max += pad
    } else {
      const pad = span * 0.1
      min -= pad
      max += pad
    }

    const yFor = (value: number) => PAD.top + innerH * (1 - (value - min) / (max - min))

    // Date-scaled x positions, clamped to the plot area.
    const tFor = (dateKey: string) => {
      if (totalDays <= 1) return 0.5
      return Math.min(1, Math.max(0, dayIndex(dateKey, rangeStart) / (totalDays - 1)))
    }
    const xFor = (dateKey: string) => PAD.left + innerW * tFor(dateKey)

    const linePath = data
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${xFor(point.date).toFixed(1)} ${yFor(point.value).toFixed(1)}`,
      )
      .join(" ")
    const areaPath =
      data.length > 1
        ? `${linePath} L ${xFor(data[data.length - 1].date).toFixed(1)} ${PAD.top + innerH} L ${xFor(data[0].date).toFixed(1)} ${PAD.top + innerH} Z`
        : null

    // Bars: each day owns a slot; bars fill ~70% of it (full slot below ~3px
    // so long ranges render as a contiguous strip). Slots are centered so the
    // first and last bar never clip the plot edges.
    const slot = innerW / totalDays
    const barWidth = slot < 3 ? slot : Math.min(26, slot * 0.7)
    const barX = (dateKey: string) =>
      PAD.left +
      slot * (Math.min(1, Math.max(0, dayIndex(dateKey, rangeStart))) + 0.5) -
      barWidth / 2

    // X tick labels — ~6 evenly spaced dates across the range (deduplicated),
    // so the axis visibly changes with the selected range.
    const targetTicks = 6
    const step = Math.max(1, Math.ceil((totalDays - 1) / targetTicks))
    const tickDates: string[] = []
    for (let day = 0; day < totalDays; day += step) {
      tickDates.push(shiftDateKey(rangeStart, day))
    }
    if (tickDates[tickDates.length - 1] !== rangeEnd) tickDates.push(rangeEnd)

    // Y grid lines at min / mid / max, but labels only at min / max so the
    // mid label never collides with a data dot sitting on the mid value.
    // Rounded to 2dp — padded domains inherit float noise from subtraction.
    const gridValues = [max, (min + max) / 2, min].map((value) => Math.round(value * 100) / 100)
    const labelValues = [max, min].map((value) => Math.round(value * 100) / 100)

    // Dots on every point get crowded past ~90 entries — sample them instead.
    const dotStep = Math.max(1, Math.ceil(data.length / 90))

    return {
      xFor,
      yFor,
      linePath,
      areaPath,
      barX,
      barWidth,
      tickDates,
      gridValues,
      labelValues,
      dotStep,
      innerW,
      innerH,
    }
  }, [data, goalValue, height, rangeEnd, rangeStart, width])

  const goalY = geometry && goalValue !== undefined ? geometry.yFor(goalValue) : null

  const handlePress = (event: GestureResponderEvent) => {
    if (!geometry || data.length === 0) return
    const native = event.nativeEvent as { locationX?: number; offsetX?: number }
    const x = native.locationX ?? native.offsetX ?? 0
    let best = 0
    let bestDistance = Infinity
    for (let index = 0; index < data.length; index += 1) {
      const distance = Math.abs(geometry.xFor(data[index].date) - x)
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    }
    onPointPress?.(data[best])
  }

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={{ width: "100%", height }}
    >
      {onPointPress ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel="Inspect chart point"
        />
      ) : null}
      {width > 0 && data.length > 0 && geometry ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>

          {geometry.gridValues.map((value) => {
            const y = geometry.yFor(value)
            return (
              <Line
                key={`grid-${value}`}
                x1={PAD.left}
                y1={y}
                x2={PAD.left + geometry.innerW}
                y2={y}
                stroke={colors.border}
                strokeOpacity={0.55}
                strokeWidth={1}
              />
            )
          })}

          {geometry.labelValues.map((value) => (
            <SvgText
              key={`label-${value}`}
              x={PAD.left - 6}
              y={geometry.yFor(value) + 3.5}
              fontSize={10}
              fill={colors.textMuted}
              textAnchor="end"
            >
              {formatValue(value)}
            </SvgText>
          ))}

          {geometry.tickDates.map((dateKey, index) => (
            <SvgText
              key={`tick-${dateKey}`}
              x={geometry.xFor(dateKey)}
              y={height - 6}
              fontSize={10}
              fill={colors.textMuted}
              textAnchor={
                index === 0 ? "start" : index === geometry.tickDates.length - 1 ? "end" : "middle"
              }
            >
              {formatDate(dateKey)}
            </SvgText>
          ))}

          {goalY !== null ? (
            <>
              <Line
                x1={PAD.left}
                y1={goalY}
                x2={PAD.left + geometry.innerW}
                y2={goalY}
                stroke={colors.warning}
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
              <SvgText
                x={PAD.left + geometry.innerW}
                y={goalY - 5}
                fontSize={10}
                fill={colors.warning}
                textAnchor="end"
              >
                Goal {formatValue(goalValue as number)}
              </SvgText>
            </>
          ) : null}

          {variant === "bars" ? (
            data.map((point) => {
              const x = geometry.barX(point.date)
              const y = geometry.yFor(point.value)
              const overGoal = goalValue !== undefined && point.value > goalValue
              return (
                <Rect
                  key={`bar-${point.date}`}
                  x={x}
                  y={y}
                  width={geometry.barWidth}
                  height={Math.max(PAD.top + geometry.innerH - y, 0)}
                  rx={Math.min(2.5, geometry.barWidth / 2)}
                  fill={overGoal ? colors.danger : color}
                />
              )
            })
          ) : (
            <>
              {geometry.areaPath ? <Path d={geometry.areaPath} fill="url(#trendFill)" /> : null}
              <Path d={geometry.linePath} fill="none" stroke={color} strokeWidth={2.5} />
              {data.map((point, index) => {
                if (index % geometry.dotStep !== 0 && index !== data.length - 1) return null
                return (
                  <Circle
                    key={`dot-${point.date}`}
                    cx={geometry.xFor(point.date)}
                    cy={geometry.yFor(point.value)}
                    r={3}
                    fill={color}
                    stroke={colors.surface}
                    strokeWidth={1.5}
                  />
                )
              })}
            </>
          )}
        </Svg>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No data for this range.</Text>
        </View>
      )}
    </View>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
  })
