import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const CartContext = createContext();
const SAVED_CART_KEY = 'dashzw_saved_cart';

function lineKey(item) {
  const variant = item.variant_id || '';
  const addons = (item.addon_ids || []).slice().sort().join(',');
  return `${item.menu_item_id}::${variant}::${addons}`;
}

function loadSavedCart() {
  try {
    const raw = localStorage.getItem(SAVED_CART_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [shopId, setShopId] = useState(null);
  const [shopName, setShopName] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('Johannesburg');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [driverTip, setDriverTip] = useState(0);
  const [cartCoupon, setCartCoupon] = useState('');
  const [cartVoucher, setCartVoucher] = useState('');
  const [useWalletPreview, setUseWalletPreview] = useState(true);
  const [hasSavedCart, setHasSavedCart] = useState(() => !!loadSavedCart()?.items?.length);

  const addItem = useCallback((item, shop) => {
    const key = lineKey(item);
    if (shopId && shopId !== shop.id) {
      // TODO(backend): Multi-merchant cart — currently one merchant per cart
      setItems([{ ...item, quantity: item.quantity || 1, _key: key }]);
      setShopId(shop.id);
      setShopName(shop.name);
      return 'switched';
    }
    setShopId(shop.id);
    setShopName(shop.name);
    setItems((prev) => {
      const existing = prev.find((i) => (i._key || lineKey(i)) === key);
      if (existing) {
        return prev.map((i) =>
          (i._key || lineKey(i)) === key
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1, _key: key }];
    });
    return 'added';
  }, [shopId]);

  const removeItem = useCallback((menuItemIdOrKey) => {
    setItems((prev) => {
      const updated = prev.filter(
        (i) => i.menu_item_id !== menuItemIdOrKey && i._key !== menuItemIdOrKey
      );
      if (updated.length === 0) {
        setShopId(null);
        setShopName('');
      }
      return updated;
    });
  }, []);

  const updateQuantity = useCallback((menuItemIdOrKey, quantity) => {
    if (quantity <= 0) {
      removeItem(menuItemIdOrKey);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.menu_item_id === menuItemIdOrKey || i._key === menuItemIdOrKey
          ? { ...i, quantity }
          : i
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    setShopId(null);
    setShopName('');
    setDriverTip(0);
    setSpecialNotes('');
    setCartCoupon('');
    setCartVoucher('');
  }, []);

  const saveCart = useCallback(() => {
    if (!items.length) return false;
    const payload = {
      items,
      shopId,
      shopName,
      deliveryMode,
      deliveryAddress,
      deliveryCity,
      deliveryInstructions,
      specialNotes,
      driverTip,
      cartCoupon,
      cartVoucher,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVED_CART_KEY, JSON.stringify(payload));
    setHasSavedCart(true);
    return true;
  }, [
    items, shopId, shopName, deliveryMode, deliveryAddress, deliveryCity,
    deliveryInstructions, specialNotes, driverTip, cartCoupon, cartVoucher,
  ]);

  const restoreSavedCart = useCallback(() => {
    const saved = loadSavedCart();
    if (!saved?.items?.length) return false;
    setItems(saved.items);
    setShopId(saved.shopId);
    setShopName(saved.shopName || '');
    setDeliveryMode(saved.deliveryMode || 'delivery');
    setDeliveryAddress(saved.deliveryAddress || '');
    setDeliveryCity(saved.deliveryCity || 'Johannesburg');
    setDeliveryInstructions(saved.deliveryInstructions || '');
    setSpecialNotes(saved.specialNotes || '');
    setDriverTip(saved.driverTip || 0);
    setCartCoupon(saved.cartCoupon || '');
    setCartVoucher(saved.cartVoucher || '');
    return true;
  }, []);

  const clearSavedCart = useCallback(() => {
    localStorage.removeItem(SAVED_CART_KEY);
    setHasSavedCart(false);
  }, []);

  useEffect(() => {
    setHasSavedCart(!!loadSavedCart()?.items?.length);
  }, [items]);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        shopId,
        shopName,
        deliveryMode,
        setDeliveryMode,
        deliveryAddress,
        setDeliveryAddress,
        deliveryCity,
        setDeliveryCity,
        deliveryInstructions,
        setDeliveryInstructions,
        specialNotes,
        setSpecialNotes,
        driverTip,
        setDriverTip,
        cartCoupon,
        setCartCoupon,
        cartVoucher,
        setCartVoucher,
        useWalletPreview,
        setUseWalletPreview,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        saveCart,
        restoreSavedCart,
        clearSavedCart,
        hasSavedCart,
        subtotal,
        itemCount,
        multiMerchantEnabled: false, // TODO(backend): multi-merchant cart
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
