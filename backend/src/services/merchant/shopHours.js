/**
 * shopHours.js — open/close logic for merchant branches (opening_hours string)
 *
 * Parses strings like "8AM - 10PM", "07:00 - 22:00", "8:00 AM - 9:00 PM"
 * Returns: { isOpen, minutesUntilClose, minutesUntilOpen, closingSoon }
 * closingSoon = true if ≤10 min left before closing
 *
 * Applies to Merchant or Branch records interchangeably.
 * TODO(postgresql): Prefer branch.opening_hours with merchant-level defaults.
 */

function parseHour(str) {
  // Normalize: "8AM" / "8:30AM" / "8:00 AM" / "20:00"
  str = str.trim().replace(/\s/g, '').toUpperCase();
  const isPM = str.includes('PM');
  const isAM = str.includes('AM');
  str = str.replace('AM','').replace('PM','');
  let [h, m] = str.split(':').map(Number);
  if (isNaN(m)) m = 0;
  if (isPM && h !== 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m; // minutes since midnight
}

export function parseOpeningHours(hoursStr) {
  if (!hoursStr) return null;
  // Split on " - " or "–" or "-"
  const parts = hoursStr.split(/\s*[-–]\s*/);
  if (parts.length < 2) return null;
  try {
    const open  = parseHour(parts[0]);
    const close = parseHour(parts[parts.length - 1]);
    return { open, close };
  } catch { return null; }
}

export function getShopStatus(shop) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const parsed = parseOpeningHours(shop.opening_hours);
  if (!parsed) {
    // No hours string — fall back to manual is_open flag
    return { isOpen: shop.is_open !== false, closingSoon: false, minutesUntilClose: null, minutesUntilOpen: null };
  }

  const { open, close } = parsed;
  // Handle overnight (e.g. 10PM - 2AM): close < open
  let isOpen;
  let minutesUntilClose = null;
  let minutesUntilOpen  = null;

  if (close > open) {
    // Normal day hours
    isOpen = nowMin >= open && nowMin < close;
    if (isOpen) minutesUntilClose = close - nowMin;
    else if (nowMin < open) minutesUntilOpen = open - nowMin;
    else minutesUntilOpen = 24 * 60 - nowMin + open; // next day
  } else {
    // Overnight
    isOpen = nowMin >= open || nowMin < close;
    if (isOpen) {
      minutesUntilClose = nowMin >= open ? (24 * 60 - nowMin + close) : (close - nowMin);
    } else {
      minutesUntilOpen = open - nowMin;
    }
  }

  const closingSoon = isOpen && minutesUntilClose !== null && minutesUntilClose <= 10;

  return { isOpen, closingSoon, minutesUntilClose, minutesUntilOpen };
}
