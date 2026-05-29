import type { SearchFoodResult } from '@/types';

export function pickBestBarcodeMatch(
  results: SearchFoodResult[],
  barcode: string,
): SearchFoodResult | null {
  if (results.length === 0) return null;
  if (results.length === 1) return results[0];

  const normalized = barcode.replace(/\D/g, '');
  const exact = results.find((r) =>
    r.name.includes(normalized) || r.product_id === normalized,
  );
  return exact ?? results[0];
}
