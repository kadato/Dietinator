import { useState, useEffect } from "react"
import {
  AccessibilityInfo,
  Animated,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
} from "react-native"
import { useToast } from "@/context/ToastContext"
import { CameraView, useCameraPermissions } from "expo-camera"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import type { MealType, SearchFoodResult } from "@/types"
import { getFoodByBarcode, searchFoodsRemote } from "@/services/yazio/foods"
import { FoodListItem } from "@/components/FoodListItem"
import { PageContainer } from "@/components/PageContainer"
import { ModalContainer } from "@/components/ModalContainer"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { useApp } from "@/context/AppContext"
import { toDateKey } from "@/utils/date"
import { routeParam } from "@/utils/route"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useSafeBack } from "@/hooks/useSafeBack"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { confirmAction } from "@/utils/confirm"
import { spacing, fonts, type ColorPalette } from "@/theme"
import { Box } from "@ui/box"
import { Input, InputField } from "@ui/input"
import { Button, ButtonText } from "@ui/button"

const MANUAL_SCAN_ON_WEB = Platform.OS === "web"
const FRAME_SIZE = 260

const cameraStyles = StyleSheet.create({
  viewfinder: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: 0,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.9)",
  },
  corner: {
    position: "absolute",
    width: 46,
    height: 46,
    borderColor: "rgba(255,255,255,0.9)",
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 0 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 0 },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 0,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 0,
  },
  scanLine: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 2,
    borderRadius: 0,
    opacity: 0.8,
    pointerEvents: "none",
  },
  frameHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 0,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  frameHintText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: fonts.mono,
    textTransform: "uppercase",
    letterSpacing: 0.06,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    pointerEvents: "box-none",
  },
  headerBarOverlay: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderColor: "rgba(255,255,255,0.15)",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: fonts.mono,
    textTransform: "uppercase",
    letterSpacing: 0.04,
  },
})

function ScanLine({ color = "rgba(255,255,255,0.85)" }: { color?: string }) {
  const [progress] = useState(() => new Animated.Value(0))

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 2200,
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [progress])

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_SIZE],
  })

  return (
    <Animated.View
      style={[
        cameraStyles.scanLine,
        {
          backgroundColor: color,
          transform: [{ translateY }],
        },
      ]}
    />
  )
}

function Viewfinder() {
  const { colors } = useTheme()
  return (
    <View style={cameraStyles.viewfinder}>
      <View style={cameraStyles.frame}>
        <View style={[cameraStyles.corner, cameraStyles.cornerTL]} />
        <View style={[cameraStyles.corner, cameraStyles.cornerTR]} />
        <View style={[cameraStyles.corner, cameraStyles.cornerBL]} />
        <View style={[cameraStyles.corner, cameraStyles.cornerBR]} />
        <ScanLine color={colors.primary} />
      </View>
      <View style={cameraStyles.frameHint}>
        <MaterialCommunityIcons name="barcode-scan" size={14} color="#ffffff" />
        <Text style={cameraStyles.frameHintText}>Align barcode in frame</Text>
      </View>
    </View>
  )
}

function BarcodeMatchesList({
  results,
  lastBarcode,
  onPick,
  onRescan,
}: {
  results: SearchFoodResult[]
  lastBarcode: string
  onPick: (food: SearchFoodResult) => void
  onRescan: () => void
}) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  return (
    <FlatList
      style={styles.list}
      data={results}
      keyExtractor={(item) => item.product_id}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.matchesHeader}>
          <View style={styles.matchesTitleWrap}>
            <Feather name="tag" size={16} color={colors.primary} />
            <Text style={styles.pickerTitle}>
              {results.length} matches for {lastBarcode}
            </Text>
          </View>
          <Pressable
            style={styles.scanAgainBtn}
            onPress={onRescan}
            accessibilityRole="button"
            accessibilityLabel="Scan another barcode"
          >
            <MaterialCommunityIcons name="barcode-scan" size={14} color={colors.onPrimary} />
            <Text style={styles.scanAgainText}>Scan another</Text>
          </Pressable>
        </View>
      }
      contentContainerClassName="pb-28"
      renderItem={({ item }) => <FoodListItem food={item} onPress={() => onPick(item)} />}
    />
  )
}

function ScanHeader({ overlay = false, onClose }: { overlay?: boolean; onClose?: () => void }) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const tint = overlay ? "#ffffff" : colors.text
  return (
    <View
      style={[
        overlay ? cameraStyles.headerOverlay : styles.headerFlow,
        {
          paddingTop: overlay ? insets.top + spacing.sm : insets.top + 16,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <View
        style={[
          styles.headerBar,
          overlay
            ? cameraStyles.headerBarOverlay
            : { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.headerTitleWrap}>
          <MaterialCommunityIcons
            name="barcode-scan"
            size={18}
            color={overlay ? "#ffffff" : colors.primary}
          />
          <Text style={[overlay ? cameraStyles.headerTitle : styles.headerTitle, { color: tint }]}>
            Scan barcode
          </Text>
        </View>
      </View>
    </View>
  )
}

export default function ScanScreen() {
  const router = useRouter()
  const routeParams = useLocalSearchParams<{ meal?: string; date?: string }>()
  const mealType = (routeParam(routeParams.meal) ?? "lunch") as MealType
  const dateKey = routeParam(routeParams.date) ?? toDateKey()
  const { setYazioAvailable } = useApp()
  const { showError } = useToast()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchFoodResult[]>([])
  const [lastBarcode, setLastBarcode] = useState("")
  const [manualBarcode, setManualBarcode] = useState("")
  const [notFound, setNotFound] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    if (!MANUAL_SCAN_ON_WEB && !permission?.granted && permission?.canAskAgain !== false) {
      requestPermission()
    }
  }, [permission, requestPermission])

  const resetForNextScan = () => {
    setResults([])
    setScanned(false)
    setLastBarcode("")
    setNotFound(false)
    setManualBarcode("")
    setTorchOn(false)
  }

  const lookupBarcode = async (barcode: string) => {
    setLoading(true)
    setLastBarcode(barcode)
    setNotFound(false)
    // Scan states are visual-only overlays otherwise; screen readers get
    // the same timeline spoken.
    AccessibilityInfo.announceForAccessibility(`Looking up barcode ${barcode}`)
    try {
      const match = await getFoodByBarcode(barcode)
      if (match) {
        openFood(match)
        return
      }
      const remote = await searchFoodsRemote(barcode)
      setYazioAvailable(true)
      if (remote.length === 0) {
        AccessibilityInfo.announceForAccessibility(`No match for barcode ${barcode}`)
        setNotFound(true)
        setScanned(false)
      } else if (remote.length === 1) {
        openFood(remote[0])
      } else {
        AccessibilityInfo.announceForAccessibility(`${remote.length} matches found`)
        setResults(remote)
      }
    } catch (error) {
      setYazioAvailable(false)
      showError(error, "Could not reach YAZIO. Try again later.", "Lookup failed")
      setScanned(false)
    } finally {
      setLoading(false)
    }
  }

  const handleManualLookup = () => {
    const barcode = manualBarcode.replace(/\D/g, "")
    if (!barcode) return
    lookupBarcode(barcode)
  }

  const confirmNotFound = () => {
    confirmAction({
      title: "Not found",
      message: "No match for this barcode. Search manually?",
      confirmLabel: "Search",
      onConfirm: () =>
        router.replace({
          pathname: "/log-meal",
          params: { meal: mealType, date: dateKey },
        }),
      onCancel: resetForNextScan,
    })
  }

  const openFood = (food: SearchFoodResult) => {
    router.replace({
      pathname: "/add-food",
      params: {
        meal: mealType,
        date: dateKey,
        productId: food.product_id,
      },
    })
  }

  const close = useSafeBack()

  if (MANUAL_SCAN_ON_WEB) {
    return (
      <View style={styles.container}>
        <ModalContainer maxWidth={640}>
          <ScanHeader onClose={close} />
          <Box className="flex-1 justify-center px-6" style={styles.webScanContent}>
            <Box
              className="mb-5 h-20 w-20 items-center justify-center rounded-none border"
              style={{
                backgroundColor: `${colors.primary}1a`,
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 0,
              }}
            >
              <MaterialCommunityIcons name="barcode-scan" size={36} color={colors.primary} />
            </Box>
            <Text style={styles.webScanTitle}>No camera here</Text>
            <Text style={styles.webScanHint}>
              No camera in the browser. Enter the barcode number from the label instead (EAN-13 /
              UPC).
            </Text>
            <Input
              size="lg"
              variant="outline"
              className="mb-4 rounded-none border bg-background-50"
              style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
            >
              <InputField
                placeholder="4000539012345"
                keyboardType="number-pad"
                value={manualBarcode}
                onChangeText={(value) => {
                  setManualBarcode(value)
                  setNotFound(false)
                }}
                autoCorrect={false}
                onSubmitEditing={handleManualLookup}
                returnKeyType="search"
                accessibilityLabel="Barcode number"
                style={{ fontFamily: fonts.mono }}
              />
            </Input>
            <Button
              size="lg"
              onPress={handleManualLookup}
              disabled={loading}
              className="rounded-none border"
              style={{
                borderWidth: 1.5,
                borderColor: colors.primary,
                borderRadius: 0,
                backgroundColor: colors.primary,
              }}
            >
              <ButtonText
                style={{
                  fontFamily: fonts.mono,
                  textTransform: "uppercase",
                  letterSpacing: 0.06,
                  color: colors.onPrimary,
                }}
              >
                {loading ? "Looking up..." : "Look up"}
              </ButtonText>
            </Button>

            {notFound ? (
              <Box className="mt-10 items-center">
                <Feather name="search" size={36} color={colors.textMuted} />
                <Text style={styles.notFoundText}>No match for {lastBarcode}.</Text>
                <Button
                  size="md"
                  variant="outline"
                  action="secondary"
                  className="mt-4 rounded-none border"
                  style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
                  onPress={confirmNotFound}
                >
                  <ButtonText
                    style={{
                      fontFamily: fonts.mono,
                      textTransform: "uppercase",
                      letterSpacing: 0.04,
                    }}
                  >
                    Search foods
                  </ButtonText>
                </Button>
                <Pressable
                  style={styles.linkBtn}
                  onPress={resetForNextScan}
                  accessibilityRole="button"
                  accessibilityLabel="Clear barcode"
                >
                  <Text style={styles.linkBtnText}>Scan again</Text>
                </Pressable>
              </Box>
            ) : null}

            {results.length > 0 ? (
              <BarcodeMatchesList
                results={results}
                lastBarcode={lastBarcode}
                onPick={openFood}
                onRescan={resetForNextScan}
              />
            ) : null}

            {loading ? (
              <Box className="mt-6 flex-row items-center justify-center gap-2">
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.overlayText}>Looking up {lastBarcode}...</Text>
              </Box>
            ) : null}
          </Box>
        </ModalContainer>
      </View>
    )
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <ScanHeader onClose={close} />
        <PageContainer variant="narrow" contentStyle={styles.centerContent}>
          <Box
            className="h-20 w-20 items-center justify-center rounded-none border bg-background-50"
            style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
          >
            <Feather name="camera" size={32} color={colors.primary} />
          </Box>
          <Text style={styles.message}>Camera access is needed to scan.</Text>
          {permission.canAskAgain === false ? (
            <>
              <Text style={styles.hint}>
                Permission denied permanently. Allow the camera in system settings.
              </Text>
              <Button
                size="lg"
                onPress={() => Linking.openSettings()}
                className="rounded-none border"
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                  borderRadius: 0,
                  backgroundColor: colors.primary,
                }}
              >
                <ButtonText
                  style={{
                    fontFamily: fonts.mono,
                    textTransform: "uppercase",
                    letterSpacing: 0.06,
                    color: colors.onPrimary,
                  }}
                >
                  Open settings
                </ButtonText>
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              onPress={requestPermission}
              className="rounded-none border"
              style={{
                borderWidth: 1.5,
                borderColor: colors.primary,
                borderRadius: 0,
                backgroundColor: colors.primary,
              }}
            >
              <ButtonText
                style={{
                  fontFamily: fonts.mono,
                  textTransform: "uppercase",
                  letterSpacing: 0.06,
                  color: colors.onPrimary,
                }}
              >
                Grant permission
              </ButtonText>
            </Button>
          )}
        </PageContainer>
      </View>
    )
  }

  const cameraActive = !results.length && !loading && !notFound

  return (
    <View style={styles.container}>
      {cameraActive || scanned ? (
        <CameraView
          style={styles.camera}
          enableTorch={torchOn}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
          }}
          onBarcodeScanned={
            scanned || loading
              ? undefined
              : ({ data }) => {
                  setScanned(true)
                  lookupBarcode(data)
                }
          }
        />
      ) : (
        <PageContainer>
          {notFound ? (
            <Box className="flex-1 items-center justify-center px-6">
              <Box
                className="h-16 w-16 items-center justify-center rounded-none border"
                style={{
                  backgroundColor: `${colors.warning}22`,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderRadius: 0,
                }}
              >
                <Feather name="alert-triangle" size={28} color={colors.warning} />
              </Box>
              <Text style={styles.notFoundText}>No match for {lastBarcode}.</Text>
              <Button
                size="md"
                variant="outline"
                action="secondary"
                className="mt-4 rounded-none border"
                style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
                onPress={confirmNotFound}
              >
                <ButtonText
                  style={{
                    fontFamily: fonts.mono,
                    textTransform: "uppercase",
                    letterSpacing: 0.04,
                  }}
                >
                  Search foods
                </ButtonText>
              </Button>
              <Pressable
                style={styles.linkBtn}
                onPress={resetForNextScan}
                accessibilityRole="button"
                accessibilityLabel="Scan another barcode"
              >
                <Text style={styles.linkBtnText}>Scan again</Text>
              </Pressable>
            </Box>
          ) : (
            <BarcodeMatchesList
              results={results}
              lastBarcode={lastBarcode}
              onPick={openFood}
              onRescan={resetForNextScan}
            />
          )}
        </PageContainer>
      )}

      {cameraActive ? <Viewfinder /> : null}

      <ScanHeader overlay={cameraActive} onClose={close} />

      {loading && (
        <View style={styles.overlay} accessibilityLiveRegion="polite">
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.overlayText, { color: colors.text }]}>
              Looking up {lastBarcode}...
            </Text>
          </View>
        </View>
      )}

      <FabCluster
        bottomOffset={insets.bottom + 20}
        left={<Fab icon="arrow-left" tone="surface" onPress={close} accessibilityLabel="Go back" />}
        right={
          cameraActive ? (
            <Fab
              tone={torchOn ? "primary" : "surface"}
              icon={torchOn ? "zap" : "zap-off"}
              onPress={() => setTorchOn((v) => !v)}
              accessibilityLabel={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
            />
          ) : undefined
        }
      />
    </View>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    camera: { flex: 1 },
    list: { flex: 1 },
    webScanContent: { padding: spacing.lg, paddingTop: spacing.sm },
    webScanTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.04,
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    webScanHint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
      fontFamily: fonts.mono,
      marginBottom: spacing.lg,
      textAlign: "center",
    },
    notFoundText: {
      color: colors.text,
      fontSize: 13,
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.04,
      textAlign: "center",
      marginTop: spacing.sm,
    },
    linkBtn: {
      marginTop: spacing.md,
      padding: spacing.sm,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    linkBtnText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 12,
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.06,
    },
    matchesHeader: {
      padding: spacing.md,
      gap: spacing.md,
    },
    matchesTitleWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    pickerTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.04,
      flex: 1,
    },
    scanAgainBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderRadius: 0,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    scanAgainText: {
      color: colors.onPrimary,
      fontWeight: "700",
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.06,
      fontSize: 12,
    },
    headerFlow: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 0,
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
      paddingVertical: spacing.sm,
      borderWidth: 1.5,
    },
    headerTitleWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.04,
    },
    center: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    message: {
      color: colors.text,
      textAlign: "center",
      marginTop: spacing.md,
      fontSize: 13,
      fontWeight: "700",
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.04,
    },
    hint: {
      color: colors.textMuted,
      textAlign: "center",
      marginBottom: spacing.lg,
      marginTop: spacing.sm,
      maxWidth: 280,
      fontFamily: fonts.mono,
      fontSize: 12,
    },
    overlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    overlayCard: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 0,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: spacing.lg,
      minWidth: 200,
      boxShadow: "none",
      elevation: 0,
    },
    overlayText: {
      marginTop: spacing.md,
      fontSize: 12,
      fontWeight: "700",
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.04,
      color: colors.textMuted,
    },
  })
