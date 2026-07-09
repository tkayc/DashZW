/** Invalidate react-query caches when a backend collection changes over SSE. */

const ORDER_QUERY_ROOTS = new Set([
  'order',
  'myOrders',
  'partner-orders',
  'partner-orders-all',
  'partner-analytics-orders',
  'partner-section-orders',
  'driver-available',
  'driver-active',
  'order-sibling',
  'order-confirmation',
]);

function queryRoot(key) {
  const root = Array.isArray(key) ? key[0] : key;
  return typeof root === 'string' ? root : '';
}

export function invalidateQueriesForCollection(qc, collection, invalidateCollection) {
  if (!collection) return;

  if (collection === 'Order') {
    qc.invalidateQueries({
      predicate: (q) => ORDER_QUERY_ROOTS.has(queryRoot(q.queryKey)),
    });
  } else if (collection === 'Notification') {
    qc.invalidateQueries({
      predicate: (q) => {
        const root = queryRoot(q.queryKey);
        return root === 'notifications' || root.includes('notification');
      },
    });
  } else if (collection === 'MenuItem' || collection === 'Product') {
    qc.invalidateQueries({
      predicate: (q) => {
        const root = queryRoot(q.queryKey);
        return root === 'menu' || root.startsWith('partner-menu') || root === 'partner-inventory';
      },
    });
  } else if (collection === 'Shop' || collection === 'Merchant') {
    qc.invalidateQueries({
      predicate: (q) => {
        const root = queryRoot(q.queryKey);
        return root === 'shop' || root === 'partner-shop' || root === 'shops' || root === 'my-shop';
      },
    });
  }

  if (typeof invalidateCollection === 'function') {
    invalidateCollection(collection);
  }
}
