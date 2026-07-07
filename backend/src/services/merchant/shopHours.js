/**
 * shopHours.js — open/close logic for merchant branches (opening_hours)
 */

function parseHour(str) {
  str = String(str).trim().replace(/\s/g, '').toUpperCase();
  const isPM = str.includes('PM');
  const isAM = str.includes('AM');
  str = str.replace('AM', '').replace('PM', '');
  let [h, m] = str.split(':').map(Number);
  if (isNaN(m)) m = 0;
  if (isPM && h !== 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m;
}

export function normalizeOpeningHours(hours) {
  if (hours == null || hours === '') return null;
  if (typeof hours === 'string') {
    const trimmed = hours.trim();
    return trimmed || null;
  }
  if (typeof hours === 'object') {
    if (typeof hours.open === 'string' && typeof hours.close === 'string') {
      return `${hours.open} - ${hours.close}`;
    }
    const values = Object.values(hours).filter((v) => typeof v === 'string' && v.trim());
    if (values.length) return values[0];
    try {
      return JSON.stringify(hours);
    } catch {
      return null;
    }
  }
  return String(hours);
}

export function parseOpeningHours(hoursInput) {
  const hoursStr = normalizeOpeningHours(hoursInput);
  if (!hoursStr) return null;
  const parts = hoursStr.split(/\s*[-–]\s*/);
  if (parts.length < 2) return null;
  try {
    const open = parseHour(parts[0]);
    const close = parseHour(parts[parts.length - 1]);
    return { open, close };
  } catch {
    return null;
  }
}

export function getShopStatus(shop) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const parsed = parseOpeningHours(shop?.opening_hours);
  if (!parsed) {
    return { isOpen: shop?.is_open !== false, closingSoon: false, minutesUntilClose: null, minutesUntilOpen: null };
  }

  const { open, close } = parsed;
  let isOpen;
  let minutesUntilClose = null;
  let minutesUntilOpen = null;

  if (close > open) {
    isOpen = nowMin >= open && nowMin < close;
    if (isOpen) minutesUntilClose = close - nowMin;
    else if (nowMin < open) minutesUntilOpen = open - nowMin;
    else minutesUntilOpen = 24 * 60 - nowMin + open;
  } else {
    isOpen = nowMin >= open || nowMin < close;
    if (isOpen) {
      minutesUntilClose = nowMin >= open ? 24 * 60 - nowMin + close : close - nowMin;
    } else {
      minutesUntilOpen = open - nowMin;
    }
  }

  const closingSoon = isOpen && minutesUntilClose !== null && minutesUntilClose <= 10;

  return { isOpen, closingSoon, minutesUntilClose, minutesUntilOpen };
}
