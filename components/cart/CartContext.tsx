"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface CartItem {
  catalog_product_id: string;
  product_title: string;
  product_image_url: string | null;
  combination_key: string | null;
  selected_options: Record<string, string>;
  quantity: number;
  unit_price: number;
  supplier_product_id: string | null;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (
    catalogProductId: string,
    combinationKey: string | null
  ) => void;
  updateQuantity: (
    catalogProductId: string,
    combinationKey: string | null,
    quantity: number
  ) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  pulseKey: number;
}

const CART_STORAGE_KEY = "gifvtme.catalog-cart";
const CartContext = createContext<CartContextValue | null>(null);

function isSameLineItem(
  item: CartItem,
  catalogProductId: string,
  combinationKey: string | null
) {
  return (
    item.catalog_product_id === catalogProductId &&
    item.combination_key === combinationKey
  );
}

function readStoredCart() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartContextProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setItems(readStoredCart());
      setIsHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [isHydrated, items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((current) => {
      const existingIndex = current.findIndex((line) =>
        isSameLineItem(
          line,
          item.catalog_product_id,
          item.combination_key
        )
      );

      if (existingIndex === -1) {
        return [...current, item];
      }

      return current.map((line, index) =>
        index === existingIndex
          ? { ...line, quantity: Math.min(99, line.quantity + item.quantity) }
          : line
      );
    });
    setPulseKey((key) => key + 1);
  }, []);

  const removeItem = useCallback(
    (catalogProductId: string, combinationKey: string | null) => {
      setItems((current) =>
        current.filter(
          (item) => !isSameLineItem(item, catalogProductId, combinationKey)
        )
      );
    },
    []
  );

  const updateQuantity = useCallback(
    (
      catalogProductId: string,
      combinationKey: string | null,
      quantity: number
    ) => {
      const nextQuantity = Math.max(1, Math.min(99, quantity));
      setItems((current) =>
        current.map((item) =>
          isSameLineItem(item, catalogProductId, combinationKey)
            ? { ...item, quantity: nextQuantity }
            : item
        )
      );
    },
    []
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      pulseKey,
    }),
    [
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      pulseKey,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within CartProvider.");
  }

  return context;
}
