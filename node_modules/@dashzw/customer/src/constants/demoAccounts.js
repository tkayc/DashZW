/** Demo logins — show only accounts for the current app role */
export const DEMO_ACCOUNTS_BY_ROLE = {
  customer: [
    { label: 'Alex Customer', email: 'customer@demo.com', password: 'demo' },
  ],
  partner: [
    { label: "Mama's Kitchen", email: 'mamas@dashzw.com', password: 'partner123' },
    { label: 'Zim Burger Co', email: 'zimburger@dashzw.com', password: 'partner123' },
    { label: 'Sunrise Bakery', email: 'sunrise@dashzw.com', password: 'partner123' },
    { label: 'Chill & Sip', email: 'chillsip@dashzw.com', password: 'partner123' },
    { label: 'Sweet Tooth', email: 'sweettooth@dashzw.com', password: 'partner123' },
    { label: 'FreshMart', email: 'freshmart@dashzw.com', password: 'partner123' },
  ],
  driver: [
    { label: 'Tendai Moyo', email: 'driver1@dashzw.com', password: 'driver123' },
    { label: 'Chido Ncube', email: 'driver2@dashzw.com', password: 'driver123' },
    { label: 'Farai Dube', email: 'driver3@dashzw.com', password: 'driver123' },
  ],
  admin: [
    { label: 'DashZW Manager', email: 'admin@dashzw.com', password: 'admin123' },
  ],
};

export function getDemoAccountsForRole(role) {
  return DEMO_ACCOUNTS_BY_ROLE[role] || [];
}
