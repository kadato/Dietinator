import { useState, useEffect } from "react"
import {
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
import { Ionicons } from "@expo/vector-icons"
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
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { confirmAction } from "@/utils/confirm"
import { spacing, type ColorPalette } from "@/theme"
import { Box } from "@ui/box"
import { Input, InputField } from "@ui/input"
import { Button, ButtonText } from "@ui/button"

const MANUAL_SCAN_ON_WEB = Platform.OS === "web"
const FRAME_SIZE = 260

/** Camera-overlay styles: fixed white-on-dark look, independent of the theme. */
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
    borderRadius: 20,
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: 46,
    height: 46,
    borderColor: "rgba(255,255,255,0.9)",
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  scanLine: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 2,
    borderRadius: 1,
    opacity: 0.8,
  },
  frameHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  frameHintText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
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
  headerTitle: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
  headerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
})

/**
 * Animated horizontal line that sweeps the viewfinder while the camera is
 * waiting for a barcode — signals "live" scanning at a glance.
 */
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
          pointerEvents: "none",
        },
      ]}
    />
  )
}

/** Barcode frame with corner brackets + sweeping scan line. */
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
        <Ionicons name="scan-outline" size={16} color="#ffffff" />
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
      ListHeaderComponent={
        <View style={styles.matchesHeader}>
          <View style={styles.matchesTitleWrap}>
            <Ionicons name="pricetags-outline" size={18} color={colors.primary} />
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
            <Ionicons name="scan-outline" size={16} color={colors.onPrimary} />
            <Text style={styles.scanAgainText}>Scan another</Text>
          </Pressable>
        </View>
      }
      contentContainerClassName="pb-28"
      renderItem={({ item }) => <FoodListItem food={item} onPress={() => onPick(item)} />}
    />
  )
}

/** Floating header pill — dark glass over the camera feed, theme surface in the browser. */
function ScanHeader({ onClose, overlay = false }: { onClose: () => void; overlay?: boolean }) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const tint = overlay ? "#ffffff" : colors.text
  return (
    <View
      style={[
        overlay ? cameraStyles.headerOverlay : styles.headerFlow,
        { paddingTop: overlay ? insets.top + spacing.md : insets.top + 16 },
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
          <Ionicons name="barcode-outline" size={20} color={colors.primary} />
          <Text style={[overlay ? cameraStyles.headerTitle : styles.headerTitle, { color: tint }]}>
            Scan barcode
          </Text>
        </View>
        <Pressable
          style={cameraStyles.headerClose}
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
        >
          <Ionicons name="close" size={22} color={tint} />
        </Pressable>
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
    try {
      const match = await getFoodByBarcode(barcode)
      if (match) {
        openFood(match)
        return
      }
      const remote = await searchFoodsRemote(barcode)
      setYazioAvailable(true)
      if (remote.length === 0) {
        setNotFound(true)
        setScanned(false)
      } else if (remote.length === 1) {
        openFood(remote[0])
      } else {
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

  const close = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace("/(tabs)")
    }
  }

  if (MANUAL_SCAN_ON_WEB) {
    return (
      <View style={styles.container}>
        <ModalContainer maxWidth={640}>
          <ScanHeader onClose={close} />
          <Box className="flex-1 justify-center px-6" style={styles.webScanContent}>
            <Box
              className="mb-5 h-20 w-20 items-center justify-center rounded-full"
              style={{ backgroundColor: `${colors.primary}1a` }}
            >
              <Ionicons name="barcode-outline" size={40} color={colors.primary} />
            </Box>
            <Text style={styles.webScanTitle}>No camera here</Text>
            <Text style={styles.webScanHint}>
              No camera in the browser. Enter the barcode number from the label instead (EAN-13 /
              UPC).
            </Text>
            <Input size="lg" variant="rounded" className="mb-4 bg-background-50">
              <InputField
                placeholder="e.g. 4000539012345"
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
              />
            </Input>
            <Button size="lg" onPress={handleManualLookup} disabled={loading}>
              <ButtonText>{loading ? "Looking up..." : "Look up"}</ButtonText>
            </Button>

            {notFound ? (
              <Box className="mt-10 items-center">
                <Ionicons name="search-outline" size={44} color={colors.textMuted} />
                <Text style={styles.notFoundText}>No match for {lastBarcode}.</Text>
                <Button
                  size="md"
                  variant="outline"
                  action="secondary"
                  className="mt-4"
                  onPress={confirmNotFound}
                >
                  <ButtonText>Search foods</ButtonText>
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
        <PageContainer variant="narrow" contentStyle={styles.centerContent}>
          <Box className="h-20 w-20 items-center justify-center rounded-full bg-background-50">
            <Ionicons name="camera-outline" size={36} color={colors.primary} />
          </Box>
          <Text style={styles.message}>Camera access is needed to scan.</Text>
          {permission.canAskAgain === false ? (
            <>
              <Text style={styles.hint}>
                Permission denied permanently. Allow the camera in system settings.
              </Text>
              <Button size="lg" onPress={() => Linking.openSettings()}>
                <ButtonText>Open settings</ButtonText>
              </Button>
            </>
          ) : (
            <Button size="lg" onPress={requestPermission}>
              <ButtonText>Grant permission</ButtonText>
            </Button>
          )}
          <Pressable style={styles.close} onPress={close} accessibilityRole="button">
            <Text style={styles.closeText}>Cancel</Text>
          </Pressable>
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
                className="h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: `${colors.warning}22` }}
              >
                <Ionicons name="warning-outline" size={30} color={colors.warning} />
              </Box>
              <Text style={styles.notFoundText}>No match for {lastBarcode}.</Text>
              <Button
                size="md"
                variant="outline"
                action="secondary"
                className="mt-4"
                onPress={confirmNotFound}
              >
                <ButtonText>Search foods</ButtonText>
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

      <ScanHeader onClose={close} />

      {loading && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.overlayText, { color: colors.text }]}>
              Looking up {lastBarcode}...
            </Text>
          </View>
        </View>
      )}

      {cameraActive ? (
        <FabCluster
          bottomOffset={insets.bottom + 20}
          right={
            <Fab
              tone={torchOn ? "primary" : "surface"}
              icon={torchOn ? "flashlight" : "flashlight-outline"}
              onPress={() => setTorchOn((v) => !v)}
              accessibilityLabel={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
            />
          }
        />
      ) : null}
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
      fontSize: 20,
      fontWeight: "700",
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    webScanHint: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: spacing.lg,
      textAlign: "center",
    },
    notFoundText: {
      color: colors.text,
      fontSize: 15,
      textAlign: "center",
      marginTop: spacing.sm,
    },
    linkBtn: { marginTop: spacing.md, padding: spacing.sm },
    linkBtnText: { color: colors.primary, fontWeight: "600", fontSize: 15 },
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
      fontSize: 16,
      fontWeight: "600",
      flex: 1,
    },
    scanAgainBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      borderRadius: 20,
      backgroundColor: colors.primary,
    },
    scanAgainText: { color: colors.onPrimary, fontWeight: "700" },
    headerFlow: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 20,
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
      paddingVertical: spacing.sm,
      borderWidth: 1,
    },
    headerTitleWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    headerTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
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
      fontSize: 16,
      fontWeight: "600",
    },
    hint: {
      color: colors.textMuted,
      textAlign: "center",
      marginBottom: spacing.lg,
      marginTop: spacing.sm,
      maxWidth: 280,
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
      borderRadius: 20,
      padding: spacing.lg,
      minWidth: 200,
      boxShadow: "0px 6px 16px rgba(0, 0, 0, 0.25)",
      elevation: 8,
    },
    // Default text color so the web branch's "Looking up…" label stays
    // readable in dark mode (the native overlay passes colors.text inline).
    overlayText: {
      marginTop: spacing.md,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textMuted,
    },
    close: { marginTop: spacing.lg, padding: spacing.sm },
    closeText: { color: colors.text, fontWeight: "600" },
  })
