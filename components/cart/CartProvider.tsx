"use client";

import type { ReactNode } from "react";
import { CartContextProvider } from "@/components/cart/CartContext";

export function CartProvider({ children }: { children: ReactNode }) {
  return <CartContextProvider>{children}</CartContextProvider>;
}
