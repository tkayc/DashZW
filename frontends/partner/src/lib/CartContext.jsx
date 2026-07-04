import React, { createContext, useContext } from 'react';

const stub = {
  items: [],
  shopId: null,
  shopName: '',
  addItem: () => 'added',
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  itemCount: 0,
  subtotal: 0,
  deliveryMode: 'delivery',
  setDeliveryMode: () => {},
  deliveryAddress: '',
  setDeliveryAddress: () => {},
};

const CartContext = createContext(stub);

export function CartProvider({ children }) {
  return <CartContext.Provider value={stub}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
