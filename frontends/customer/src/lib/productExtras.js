/**
 * Mock product variants / add-ons by merchant category.
 * Real catalog would come from Product.variants / Product.addons in PostgreSQL.
 *
 * TODO(postgresql): product_variants, product_addons, product_stock tables.
 */

export function getMockVariants(product, merchantCategory) {
  if (!product) return [];
  const cat = merchantCategory || '';

  if (cat === 'restaurant' || cat === 'fast_food') {
    return [
      { id: 'size_reg', name: 'Regular', priceDelta: 0 },
      { id: 'size_lg', name: 'Large', priceDelta: 15 },
    ];
  }
  if (cat === 'grocery' || cat === 'convenience') {
    return [
      { id: 'pack_1', name: 'Single', priceDelta: 0 },
      { id: 'pack_3', name: '3-pack', priceDelta: product.price * 1.8 - product.price },
    ];
  }
  if (cat === 'pharmacy') {
    return [
      { id: 'qty_1', name: '1 pack', priceDelta: 0 },
      { id: 'qty_2', name: '2 packs', priceDelta: product.price * 0.9 },
    ];
  }
  if (cat === 'flowers') {
    return [
      { id: 'bouquet_s', name: 'Small bouquet', priceDelta: 0 },
      { id: 'bouquet_l', name: 'Large bouquet', priceDelta: 80 },
    ];
  }
  return [
    { id: 'std', name: 'Standard', priceDelta: 0 },
  ];
}

export function getMockAddons(product, merchantCategory) {
  const cat = merchantCategory || '';
  if (cat === 'restaurant' || cat === 'fast_food') {
    return [
      { id: 'extra_sauce', name: 'Extra sauce', price: 8 },
      { id: 'side_chips', name: 'Side of chips', price: 25 },
      { id: 'drink', name: 'Soft drink', price: 20 },
    ];
  }
  if (cat === 'grocery') {
    return [
      { id: 'bag', name: 'Reusable bag', price: 5 },
      { id: 'ice', name: 'Ice pack (cold items)', price: 10 },
    ];
  }
  if (cat === 'flowers') {
    return [
      { id: 'card', name: 'Greeting card', price: 15 },
      { id: 'vase', name: 'Vase', price: 45 },
    ];
  }
  return [
    { id: 'gift_wrap', name: 'Gift wrap', price: 12 },
  ];
}

export function getMockPrepMinutes(merchantCategory) {
  const map = {
    restaurant: 20,
    fast_food: 12,
    grocery: 8,
    pharmacy: 10,
    convenience: 6,
    bakery: 10,
    flowers: 15,
    hardware: 12,
    electronics: 15,
    drinks: 8,
    desserts: 12,
  };
  return map[merchantCategory] || 15;
}

export function getStockStatus(product) {
  if (product?.is_available === false) return { inStock: false, label: 'Out of stock' };
  // Mock low stock for popular items
  if (product?.is_popular) return { inStock: true, label: 'In stock · Limited', low: true };
  return { inStock: true, label: 'In stock', low: false };
}

/** Placeholder nutrition facts — TODO(postgresql): product_nutrition table */
export function getMockNutrition(product) {
  if (!product) return null;
  return {
    calories: 320 + (product.price || 0) % 200,
    protein_g: 12,
    carbs_g: 38,
    fat_g: 14,
    note: 'Estimated values — not verified',
  };
}

/** Placeholder allergens — TODO(postgresql): product_allergens table */
export function getMockAllergens(product, merchantCategory) {
  const cat = merchantCategory || '';
  if (cat === 'restaurant' || cat === 'fast_food' || cat === 'bakery' || cat === 'desserts') {
    return ['Gluten', 'Dairy', 'May contain nuts'];
  }
  if (cat === 'pharmacy') return ['Check packaging for full list'];
  return ['See product packaging'];
}

/** Mock product reviews for PDP */
export function getMockProductReviews(productId) {
  return [
    { id: 'r1', name: 'Tendai M.', rating: 5, body: 'Exactly as described. Fast prep.', date: '2 days ago' },
    { id: 'r2', name: 'Chipo K.', rating: 4, body: 'Good quality. Would order again.', date: '1 week ago' },
  ];
}

/** Extra gallery images (mock) */
export function getMockProductImages(product) {
  const primary = product?.image_url;
  if (!primary) return [];
  return [primary];
}
