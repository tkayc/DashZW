/**
 * Per-collection access policy for /api/entities/*
 *
 * roles: JWT roles that have full access to the collection
 * ownerField: field on the record (or special resolver key) identifying the owner email
 * allowOwnerRead / allowOwnerWrite / allowOwnerRW: owner may read/write their own rows
 * publicRead: any authenticated user may read (list/filter/get)
 * partnerField: partner may access when this email field matches
 * allowPartnerRW: partner may read+write matching partnerField rows
 * driverField: driver may access when this email field matches
 * allowDriverRW: driver may read+write matching driverField rows
 * allowDriverReadUnassigned: drivers may read Order rows with no driver and ready_for_pickup
 * resolveOwner: 'shop' — owner is Shop.owner_email via shop_id/merchant_id
 */

export const ENTITY_POLICY = {
  Order: {
    roles: ['admin'],
    ownerField: 'customer_email',
    allowOwnerRW: true,
    partnerField: 'partner_email',
    allowPartnerRW: true,
    driverField: 'driver_email',
    allowDriverRW: true,
    allowDriverReadUnassigned: true,
  },
  Wallet: {
    roles: ['admin'],
    ownerField: 'owner_email',
    allowOwnerRead: true,
    allowOwnerWrite: false,
  },
  Transaction: {
    roles: ['admin'],
    ownerField: 'owner_email',
    allowOwnerRead: true,
    allowOwnerWrite: false,
  },
  Settlement: {
    roles: ['admin'],
  },
  Withdrawal: {
    roles: ['admin'],
    ownerField: 'owner_email',
    allowOwnerRead: true,
    allowOwnerWrite: false,
    // drivers create withdrawals via domain settlements.driverWithdraw, not entity write
  },
  Shop: {
    roles: ['admin'],
    ownerField: 'owner_email',
    allowOwnerRW: true,
    publicRead: true,
    partnerRoles: ['partner', 'merchant_owner'],
  },
  Merchant: {
    roles: ['admin'],
    ownerField: 'owner_email',
    allowOwnerRW: true,
    publicRead: true,
    partnerRoles: ['partner', 'merchant_owner'],
  },
  MenuItem: {
    roles: ['admin'],
    resolveOwner: 'shop',
    allowOwnerRW: true,
    publicRead: true,
    partnerRoles: ['partner', 'merchant_owner'],
  },
  Product: {
    roles: ['admin'],
    resolveOwner: 'shop',
    allowOwnerRW: true,
    publicRead: true,
    partnerRoles: ['partner', 'merchant_owner'],
  },
  Branch: {
    roles: ['admin'],
    resolveOwner: 'shop',
    allowOwnerRW: true,
    publicRead: true,
    partnerRoles: ['partner', 'merchant_owner'],
  },
  MerchantStaff: {
    roles: ['admin'],
    resolveOwner: 'shop',
    allowOwnerRW: true,
    partnerRoles: ['partner', 'merchant_owner'],
  },
  Review: {
    roles: ['admin'],
    ownerField: 'customer_email',
    allowOwnerRead: true,
    allowOwnerWrite: true, // create own review
    publicRead: true,
  },
  Promotion: {
    roles: ['admin'],
    resolveOwner: 'shop',
    allowOwnerRW: true,
    publicRead: true,
    partnerRoles: ['partner', 'merchant_owner'],
  },
  AdminPromotion: {
    roles: ['admin'],
  },
  DriverProfile: {
    roles: ['admin'],
    ownerField: 'email',
    allowOwnerRW: true,
  },
  Notification: {
    roles: ['admin'],
    ownerField: 'recipient_email',
    allowOwnerRW: true,
  },
  Referral: {
    roles: ['admin'],
    ownerField: 'owner_email',
    allowOwnerRead: true,
    allowOwnerWrite: false,
  },
  LoyaltyPoints: {
    roles: ['admin'],
    ownerField: 'owner_email',
    allowOwnerRead: true,
    allowOwnerWrite: false,
  },
  DriverIncident: {
    roles: ['admin'],
    ownerField: 'driver_email',
    allowOwnerRead: true,
    allowOwnerWrite: true, // driver may report
  },
};

export function getPolicy(collection) {
  return ENTITY_POLICY[collection] || { roles: ['admin'] };
}
