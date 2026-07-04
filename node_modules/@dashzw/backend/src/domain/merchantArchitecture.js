/**
 * Merchant architecture — multi-branch merchants with staff & verification.
 * Aligns with backend Branch / MerchantStaff collections.
 *
 * TODO(postgresql): merchants, merchant_branches, merchant_staff,
 *   merchant_documents, merchant_branding tables.
 */

export const MERCHANT_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

export const MERCHANT_VERIFICATION = {
  UNVERIFIED: 'unverified',
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
};

export const BRANCH_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  PAUSED: 'paused',
  COMING_SOON: 'coming_soon',
};

/**
 * Conceptual branch shape (mock / future API).
 * address, operating_hours, manager, staff[], delivery_radius_km,
 * inventory[], orders[], analytics, status, images[]
 */
export function buildBranchProfile(branch, merchant) {
  if (!branch && merchant) {
    return {
      id: merchant.default_branch_id || `branch_${merchant.id}`,
      merchant_id: merchant.id,
      name: 'Main',
      address: merchant.address,
      city: merchant.city,
      operating_hours: merchant.opening_hours,
      manager_email: merchant.owner_email,
      staff: [],
      delivery_radius_km: 8,
      inventory: [],
      orders: [],
      analytics: { orders_today: 0, revenue_today: 0 },
      status: merchant.is_open ? BRANCH_STATUS.OPEN : BRANCH_STATUS.CLOSED,
      images: merchant.image_url ? [merchant.image_url] : [],
      lat: merchant.lat,
      lng: merchant.lng,
    };
  }
  return {
    delivery_radius_km: branch?.delivery_radius_km ?? 8,
    manager_email: branch?.manager_email || null,
    staff: branch?.staff || [],
    inventory: branch?.inventory || [],
    analytics: branch?.analytics || { orders_today: 0, revenue_today: 0 },
    status: branch?.status || (branch?.is_open === false ? BRANCH_STATUS.CLOSED : BRANCH_STATUS.OPEN),
    images: branch?.images || [],
    ...branch,
  };
}

export function merchantApprovalStatus(merchant) {
  return merchant?.approval_status || MERCHANT_STATUS.PENDING_APPROVAL;
}

export function merchantVerificationStatus(merchant) {
  return merchant?.verification_status || MERCHANT_VERIFICATION.UNVERIFIED;
}

/** Branding fields (mock defaults) */
export function merchantBranding(merchant) {
  return {
    logo_url: merchant?.image_url || null,
    cover_url: merchant?.cover_url || merchant?.image_url || null,
    primary_color: merchant?.brand_color || null,
    tagline: merchant?.description || '',
  };
}

/** Document checklist placeholder */
export const MERCHANT_DOCUMENT_TYPES = [
  'business_registration',
  'tax_clearance',
  'id_document',
  'bank_proof',
  'food_hygiene', // optional by category
];
