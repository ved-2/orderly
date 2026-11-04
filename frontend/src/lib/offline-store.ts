"use client";

export interface CachedCatalogueItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  brand_name: string;
  pack_size: number;
  pack_unit: string;
  units_per_case: number;
  price: number;
  quantity_available: number;
  schemes: Array<{
    scheme_name: string;
    scheme_type: string;
    buy_quantity: number | null;
    reward_quantity: number | null;
    min_quantity: number | null;
    discount_type: string | null;
    discount_value: number | null;
  }>;
}

export interface QueuedOrder {
  idempotency_key: string;
  retailer_id: string;
  shop_name: string;
  items: Array<{
    product_id: string;
    product_name: string;
    sku: string;
    quantity: number;
    quantity_unit: "CASE" | "PIECE";
    price: number;
  }>;
  customer_note: string | null;
  estimated_total: number;
  queued_at: string;
}

const CATALOGUE_KEY = "orderly_salesman_catalogue_v1";
const QUEUE_KEY = "orderly_salesman_offline_queue_v1";

export function saveCachedCatalogue(items: CachedCatalogueItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CATALOGUE_KEY, JSON.stringify(items));
    localStorage.setItem(`${CATALOGUE_KEY}_timestamp`, new Date().toISOString());
  } catch (e) {
    console.error("Failed to save catalogue to offline store:", e);
  }
}

export function getCachedCatalogue(): { items: CachedCatalogueItem[]; cachedAt: string | null } {
  if (typeof window === "undefined") return { items: [], cachedAt: null };
  try {
    const raw = localStorage.getItem(CATALOGUE_KEY);
    const cachedAt = localStorage.getItem(`${CATALOGUE_KEY}_timestamp`);
    if (!raw) return { items: [], cachedAt: null };
    return { items: JSON.parse(raw), cachedAt };
  } catch (e) {
    console.error("Failed to read catalogue from offline store:", e);
    return { items: [], cachedAt: null };
  }
}

export function queueOfflineOrder(order: QueuedOrder): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getOfflineQueue();
    // Avoid duplicate queueing with same idempotency key
    const filtered = existing.filter((o) => o.idempotency_key !== order.idempotency_key);
    filtered.push(order);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("Failed to queue offline order:", e);
  }
}

export function getOfflineQueue(): QueuedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to read offline order queue:", e);
    return [];
  }
}

export function removeOfflineOrder(idempotencyKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getOfflineQueue();
    const updated = existing.filter((o) => o.idempotency_key !== idempotencyKey);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to remove order from offline queue:", e);
  }
}

export function clearOfflineQueue(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch (e) {
    console.error("Failed to clear offline queue:", e);
  }
}
