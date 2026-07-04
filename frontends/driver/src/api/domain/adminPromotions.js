import { invoke } from '../client.js';

export const getAdminPromotions = () => invoke('adminPromotions', 'getAdminPromotions', []);
export const createAdminPromotion = (d) => invoke('adminPromotions', 'createAdminPromotion', [d]);
export const updateAdminPromotion = (id, d) => invoke('adminPromotions', 'updateAdminPromotion', [id, d]);
export const deleteAdminPromotion = (id) => invoke('adminPromotions', 'deleteAdminPromotion', [id]);
export const validateAdminCoupon = (c, e, s) =>
  invoke('adminPromotions', 'validateAdminCoupon', [c, e, s], { public: true });
export const calcAdminPromoDiscount = (p, s, d) =>
  invoke('adminPromotions', 'calcAdminPromoDiscount', [p, s, d], { public: true });
