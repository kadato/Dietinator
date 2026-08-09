import { useState, useEffect } from "react"
import {
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
import { useApp } from "@/context/AppContext"
import { toDateKey } from "@/utils/date"
import { routeParam } from "@/utils/route"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { confirmAction } from "@/utils/confirm"
import { spacing, type ColorPalette } from "@/theme"
import { Box } from "@ui/box"
import { Input, InputField } from "@ui/input"
import { Button, ButtonText } from "@ui/button"

const MANUAL_SCAN_ON_WEB = Platform.OS === "web"

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
  const styles = useThemedStyles(createStyles)
  return (
    <FlatList
      style={styles.list}
      data={results}
      keyExtractor={(item) => item.product_id}
      ListHeaderComponent={
        <>
          <Text style={styles.pickerTitle}>Multiple matches for {lastBarcode}</Text>
          <Pressable
            style={styles.scanAgainBtn}
            onPress={onRescan}
            accessibilityRole="button"
            accessibilityLabel="Scan another barcode"
          >
            <Text style={styles.scanAgainText}>Scan another</Text>
          </Pressable>
        </>
      }
      renderItem={({ item }) => <FoodListItem food={item} onPress={() => onPick(item)} />}
    />
  )
}

function ScanHeader({ onClose, overlay = false }: { onClose: () => void; overlay?: boolean }) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  return (
    <View style={overlay ? styles.headerOverlay : styles.headerFlow} pointerEvents="box-none">
      <View style={[styles.headerBar, { backgroundColor: colors.background }]}>
        <View style={styles.headerTitleWrap}>
          <Ionicons name="barcode-outline" size={20} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Scan barcode</Text>
        </View>
        <Pressable
          style={[styles.headerClose, { backgroundColor: colors.surfaceAlt }]}
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
        >
          <Ionicons name="close" size={22} color={colors.text} />
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
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchFoodResult[]>([])
  const [lastBarcode, setLastBarcode] = useState("")
  const [manualBarcode, setManualBarcode] = useState("")
  const [notFound, setNotFound] = useState(false)

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
      message: "No YAZIO match for this barcode. Try manual search.",
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
        <ModalContainer hug maxWidth={640}>
          <ScanHeader onClose={close} overlay={!results.length} />
          <Box className="flex-1" style={styles.webScanContent}>
            <Text style={styles.webScanHint}>
              Camera scanning is not available in the browser. Enter the barcode number from the
              product label instead (EAN-13 / UPC).
            </Text>
            <Input size="lg" variant="rounded" className="mb-3 bg-background-50">
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
              <ButtonText>{loading ? "Looking up..." : "Look up barcode"}</ButtonText>
            </Button>

            {notFound ? (
              <Box className="mt-8 items-center">
                <Ionicons name="search-outline" size={44} color={colors.textMuted} />
                <Text style={styles.notFoundText}>No YAZIO match for {lastBarcode}.</Text>
                <Button
                  size="md"
                  variant="outline"
                  action="secondary"
                  className="mt-4"
                  onPress={confirmNotFound}
                >
                  <ButtonText>Search for a food instead</ButtonText>
                </Button>
                <Pressable
                  style={styles.linkBtn}
                  onPress={resetForNextScan}
                  accessibilityRole="button"
                  accessibilityLabel="Clear barcode"
                >
                  <Text style={styles.linkBtnText}>Try another barcode</Text>
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
          <Text style={styles.message}>Camera permission is required to scan barcodes.</Text>
          {permission.canAskAgain === false ? (
            <>
              <Text style={styles.hint}>
                Permission was denied permanently. Open system settings to allow the camera.
              </Text>
              <Pressable
                style={styles.btn}
                onPress={() => Linking.openSettings()}
                accessibilityRole="button"
                accessibilityLabel="Open system settings"
              >
                <Text style={styles.btnText}>Open settings</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={styles.btn}
              onPress={requestPermission}
              accessibilityRole="button"
              accessibilityLabel="Grant camera permission"
            >
              <Text style={styles.btnText}>Grant permission</Text>
            </Pressable>
          )}
          <Pressable style={styles.close} onPress={close} accessibilityRole="button">
            <Text style={styles.closeText}>Cancel</Text>
          </Pressable>
        </PageContainer>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {!results.length ? (
        <CameraView
          style={styles.camera}
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
          <BarcodeMatchesList
            results={results}
            lastBarcode={lastBarcode}
            onPick={openFood}
            onRescan={resetForNextScan}
          />
        </PageContainer>
      )}

      {!results.length ? (
        <View style={styles.viewfinder} pointerEvents="none">
          <View style={styles.frame} />
          <View style={styles.frameHint}>
            <Ionicons name="scan-outline" size={16} color="#ffffff" />
            <Text style={styles.frameHintText}>Align the barcode inside the frame</Text>
          </View>
        </View>
      ) : null}

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

      <View style={styles.closeFabWrap} pointerEvents="box-none">
        <Pressable
          style={styles.closeFab}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
        >
          <Ionicons name="close" size={26} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    camera: { flex: 1 },
    list: { flex: 1 },
    webScanContent: { padding: spacing.lg, paddingTop: spacing.sm },
    webScanHint: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    notFoundText: {
      color: colors.text,
      fontSize: 15,
      textAlign: "center",
      marginTop: spacing.sm,
    },
    linkBtn: { marginTop: spacing.md },
    linkBtnText: { color: colors.primary, fontWeight: "600", fontSize: 15 },
    pickerTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
      padding: spacing.md,
    },
    scanAgainBtn: {
      alignSelf: "flex-start",
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: 20,
      backgroundColor: colors.primary,
    },
    scanAgainText: { color: colors.onPrimary, fontWeight: "700" },
    headerOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    headerFlow: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 16,
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    headerTitleWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    headerTitle: { fontSize: 17, fontWeight: "700" },
    headerClose: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    viewfinder: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    frame: {
      width: 250,
      height: 250,
      borderRadius: 28,
      borderWidth: 3,
      borderColor: "rgba(255,255,255,0.85)",
      backgroundColor: "transparent",
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 0 },
    },
    frameHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: spacing.md,
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 20,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    frameHintText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
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
    btn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: 28,
    },
    btnText: { color: colors.onPrimary, fontWeight: "700" },
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
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    overlayText: { marginTop: spacing.md, fontSize: 14, fontWeight: "600" },
    closeFabWrap: {
      position: "absolute",
      bottom: 40,
      left: 0,
      right: 0,
      alignItems: "center",
    },
    closeFab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.6)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    close: { marginTop: spacing.md },
    closeText: { color: colors.text, fontWeight: "600" },
  })
