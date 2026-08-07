import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  TextInput,
} from 'react-native';
import { useToast } from '@/context/ToastContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { MealType } from '@/types';
import { getFoodByBarcode, searchFoodsRemote } from '@/services/yazio/foods';
import { FoodListItem } from '@/components/FoodListItem';
import { PageContainer } from '@/components/PageContainer';
import { ModalContainer } from '@/components/ModalContainer';
import { useApp } from '@/context/AppContext';
import type { SearchFoodResult } from '@/types';
import { toDateKey } from '@/utils/date';
import { routeParam } from '@/utils/route';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { confirmAction } from '@/utils/confirm';
import { spacing, type ColorPalette } from '@/theme';
import { Box } from '@ui/box';
import { Input, InputField } from '@ui/input';
import { Button, ButtonText } from '@ui/button';

const MANUAL_SCAN_ON_WEB = Platform.OS === 'web';

export default function ScanScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ meal?: string; date?: string }>();
  const mealType = (routeParam(routeParams.meal) ?? 'lunch') as MealType;
  const dateKey = routeParam(routeParams.date) ?? toDateKey();
  const { setYazioAvailable } = useApp();
  const { showError } = useToast();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchFoodResult[]>([]);
  const [lastBarcode, setLastBarcode] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!MANUAL_SCAN_ON_WEB && !permission?.granted && permission?.canAskAgain !== false) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const resetForNextScan = () => {
    setResults([]);
    setScanned(false);
    setLastBarcode('');
    setNotFound(false);
    setManualBarcode('');
  };

  const lookupBarcode = async (barcode: string) => {
    setLoading(true);
    setLastBarcode(barcode);
    setNotFound(false);
    try {
      const match = await getFoodByBarcode(barcode);
      if (match) {
        openFood(match);
        return;
      }
      const remote = await searchFoodsRemote(barcode);
      setYazioAvailable(true);
      if (remote.length === 0) {
        setNotFound(true);
        setScanned(false);
      } else if (remote.length === 1) {
        openFood(remote[0]);
      } else {
        setResults(remote);
      }
    } catch (error) {
      setYazioAvailable(false);
      showError(error, 'Could not reach YAZIO. Try again later.', 'Lookup failed');
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const handleManualLookup = () => {
    const barcode = manualBarcode.replace(/\D/g, '');
    if (!barcode) return;
    lookupBarcode(barcode);
  };

  const confirmNotFound = () => {
    confirmAction({
      title: 'Not found',
      message: 'No YAZIO match for this barcode. Try manual search.',
      confirmLabel: 'Search',
      onConfirm: () =>
        router.replace({
          pathname: '/log-meal',
          params: { meal: mealType, date: dateKey },
        }),
      onCancel: resetForNextScan,
    });
  };

  const openFood = (food: SearchFoodResult) => {
    router.replace({
      pathname: '/add-food',
      params: {
        meal: mealType,
        date: dateKey,
        productId: food.product_id,
      },
    });
  };

  if (MANUAL_SCAN_ON_WEB) {
    return (
      <View style={styles.container}>
        <ModalContainer hug maxWidth={640}>
        <Box className="flex-1" style={styles.webScanContent}>
          <Box className="flex-row items-center justify-between mb-2">
            <Text style={styles.webScanTitle}>Scan barcode</Text>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </Pressable>
          </Box>
          <Text style={styles.webScanHint}>
            Camera scanning is not available in the browser. Enter the barcode
            number from the product label instead (EAN-13 / UPC).
          </Text>
          <Input size="lg" variant="rounded" className="bg-background-50 mb-3">
            <InputField
              placeholder="e.g. 4000539012345"
              keyboardType="number-pad"
              value={manualBarcode}
              onChangeText={(value) => {
                setManualBarcode(value);
                setNotFound(false);
              }}
              autoCorrect={false}
              onSubmitEditing={handleManualLookup}
              returnKeyType="search"
              accessibilityLabel="Barcode number"
            />
          </Input>
          <Button size="lg" onPress={handleManualLookup} disabled={loading}>
            <ButtonText>{loading ? 'Looking up...' : 'Look up barcode'}</ButtonText>
          </Button>

          {notFound ? (
            <Box className="mt-8 items-center">
              <Ionicons name="search-outline" size={44} color={colors.textMuted} />
              <Text style={styles.notFoundText}>
                No YAZIO match for {lastBarcode}.
              </Text>
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
            <FlatList
              style={styles.list}
              data={results}
              keyExtractor={(item) => item.product_id}
              ListHeaderComponent={
                <>
                  <Text style={styles.pickerTitle}>Multiple matches for {lastBarcode}</Text>
                  <Pressable
                    style={styles.scanAgainBtn}
                    onPress={resetForNextScan}
                    accessibilityRole="button"
                    accessibilityLabel="Scan another barcode"
                  >
                    <Text style={styles.scanAgainText}>Scan another</Text>
                  </Pressable>
                </>
              }
              renderItem={({ item }) => (
                <FoodListItem food={item} onPress={() => openFood(item)} />
              )}
            />
          ) : null}

          {loading ? (
            <Box className="flex-row items-center justify-center gap-2 mt-6">
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.overlayText}>Looking up {lastBarcode}...</Text>
            </Box>
          ) : null}
        </Box>
        </ModalContainer>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <PageContainer variant="narrow" contentStyle={styles.centerContent}>
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
          <Pressable style={styles.close} onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.closeText}>Cancel</Text>
          </Pressable>
        </PageContainer>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!results.length ? (
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
          }}
          onBarcodeScanned={
            scanned || loading
              ? undefined
              : ({ data }) => {
                  setScanned(true);
                  lookupBarcode(data);
                }
          }
        />
      ) : (
        <PageContainer>
          <FlatList
            style={styles.list}
            data={results}
            keyExtractor={(item) => item.product_id}
            ListHeaderComponent={
              <>
                <Text style={styles.pickerTitle}>Multiple matches for {lastBarcode}</Text>
                <Pressable
                  style={styles.scanAgainBtn}
                  onPress={resetForNextScan}
                  accessibilityRole="button"
                  accessibilityLabel="Scan another barcode"
                >
                  <Text style={styles.scanAgainText}>Scan another</Text>
                </Pressable>
              </>
            }
            renderItem={({ item }) => (
              <FoodListItem food={item} onPress={() => openFood(item)} />
            )}
          />
        </PageContainer>
      )}
      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.overlayText}>Looking up {lastBarcode}...</Text>
        </View>
      )}
      <Pressable
        style={styles.closeFab}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Close scanner"
      >
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  camera: { flex: 1 },
  list: { flex: 1 },
  webScanContent: { padding: spacing.lg, paddingTop: spacing.md },
  webScanTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  webScanHint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  notFoundText: {
    color: colors.text,
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  linkBtn: { marginTop: spacing.md },
  linkBtnText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  pickerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    padding: spacing.md,
  },
  scanAgainBtn: {
    alignSelf: 'flex-start',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  scanAgainText: { color: colors.onPrimary, fontWeight: '700' },
  center: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  message: { color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  hint: {
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 280,
  },
  btn: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 10,
  },
  btnText: { color: colors.onPrimary, fontWeight: '700' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: '#ffffff', marginTop: spacing.md },
  closeFab: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 24,
  },
  close: { marginTop: spacing.md },
  closeText: { color: colors.text, fontWeight: '600' },
});
