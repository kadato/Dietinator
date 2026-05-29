import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { getFoodByBarcode, searchFoodsRemote } from '@/services/yazio/foods';
import { FoodListItem } from '@/components/FoodListItem';
import { useApp } from '@/context/AppContext';
import type { SearchFoodResult } from '@/types';
import { toDateKey } from '@/utils/date';
import { colors, spacing } from '@/theme';

export default function ScanScreen() {
  const router = useRouter();
  const { setYazioAvailable } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchFoodResult[]>([]);
  const [lastBarcode, setLastBarcode] = useState('');

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const lookupBarcode = async (barcode: string) => {
    setLoading(true);
    setLastBarcode(barcode);
    try {
      const match = await getFoodByBarcode(barcode);
      if (match) {
        openFood(match);
        return;
      }
      const remote = await searchFoodsRemote(barcode);
      setYazioAvailable(true);
      if (remote.length === 0) {
        Alert.alert(
          'Not found',
          'No YAZIO match for this barcode. Try manual search.',
          [{ text: 'Search', onPress: () => router.replace('/(tabs)/search') }, { text: 'OK' }],
        );
        setScanned(false);
      } else if (remote.length === 1) {
        openFood(remote[0]);
      } else {
        setResults(remote);
      }
    } catch {
      setYazioAvailable(false);
      Alert.alert('Lookup failed', 'Could not reach YAZIO. Try again later.');
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const openFood = (food: SearchFoodResult) => {
    router.replace({
      pathname: '/add-food',
      params: {
        meal: 'lunch',
        date: toDateKey(),
        productId: food.product_id,
        name: food.name,
        kcal: String(food.nutrients.kcal),
        amount: String(food.serving.amount),
        unit: food.base_unit,
        protein: String(food.nutrients.protein),
        carbs: String(food.nutrients.carbs),
        fat: String(food.nutrients.fat),
        serving: food.serving.serving,
        servingQty: String(food.serving.serving_quantity),
      },
    });
  };

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
        <Text style={styles.message}>Camera permission is required to scan barcodes.</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant permission</Text>
        </Pressable>
        <Pressable style={styles.close} onPress={() => router.back()}>
          <Text style={styles.closeText}>Cancel</Text>
        </Pressable>
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
        <FlatList
          style={styles.list}
          data={results}
          keyExtractor={(item) => item.product_id}
          ListHeaderComponent={
            <Text style={styles.pickerTitle}>Multiple matches for {lastBarcode}</Text>
          }
          renderItem={({ item }) => (
            <FoodListItem food={item} onPress={() => openFood(item)} />
          )}
        />
      )}
      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.overlayText}>Looking up {lastBarcode}...</Text>
        </View>
      )}
      <Pressable style={styles.closeFab} onPress={() => router.back()}>
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  camera: { flex: 1 },
  list: { flex: 1 },
  pickerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    padding: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  message: { color: colors.text, textAlign: 'center', marginBottom: spacing.lg },
  btn: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 10,
  },
  btnText: { color: colors.background, fontWeight: '700' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: colors.text, marginTop: spacing.md },
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
