export type QuantityUnit = "CASE" | "PIECE";

export interface CartItem {
  product_id: string;
  sku: string;
  name: string;
  brand_name: string;
  pack_size: number;
  pack_unit: string;
  units_per_case: number;
  price: number;
  gst_included: boolean;
  quantity_available: number;
  quantity: number;
  quantity_unit: QuantityUnit;
  image_url?: string | null;
}

const CART_KEY = "orderly_cart_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getCart(): CartItem[] {
  if (!isBrowser()) return [];

  try {
    const stored = localStorage.getItem(CART_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  if (!isBrowser()) return;

  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("orderly-cart-updated"));
}

export function addToCart(item: CartItem): void {
  const cart = getCart();

  const existing = cart.find(
    (entry) =>
      entry.product_id === item.product_id &&
      entry.quantity_unit === item.quantity_unit,
  );

  const updated = existing
    ? cart.map((entry) =>
        entry.product_id === item.product_id &&
        entry.quantity_unit === item.quantity_unit
          ? { ...entry, quantity: entry.quantity + item.quantity }
          : entry,
      )
    : [...cart, item];

  const target = updated.find(
    (entry) =>
      entry.product_id === item.product_id &&
      entry.quantity_unit === item.quantity_unit,
  );

  if (!target || target.quantity <= 0) {
    throw new Error("Invalid cart quantity.");
  }

  const requiredPieces =
    target.quantity_unit === "CASE"
      ? target.quantity * target.units_per_case
      : target.quantity;

  if (requiredPieces > target.quantity_available) {
    throw new Error("Requested quantity exceeds available stock.");
  }

  saveCart(updated);
}

export function updateCartQuantity(
  productId: string,
  quantityUnit: QuantityUnit,
  quantity: number,
): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive whole number.");
  }

  const cart = getCart();

  const updated = cart.map((item) => {
    if (
      item.product_id !== productId ||
      item.quantity_unit !== quantityUnit
    ) {
      return item;
    }

    const requiredPieces =
      quantityUnit === "CASE" ? quantity * item.units_per_case : quantity;

    if (requiredPieces > item.quantity_available) {
      throw new Error("Requested quantity exceeds available stock.");
    }

    return { ...item, quantity };
  });

  saveCart(updated);
}

export function removeFromCart(
  productId: string,
  quantityUnit: QuantityUnit,
): void {
  saveCart(
    getCart().filter(
      (item) =>
        item.product_id !== productId ||
        item.quantity_unit !== quantityUnit,
    ),
  );
}

export function clearCart(): void {
  saveCart([]);
}

export function getCartItemCount(): number {
  return getCart().reduce((total, item) => total + item.quantity, 0);
}

export function getCartSubtotal(): number {
  return getCart().reduce((total, item) => {
    const multiplier =
      item.quantity_unit === "CASE" ? item.units_per_case : 1;

    return total + item.price * item.quantity * multiplier;
  }, 0);
}
