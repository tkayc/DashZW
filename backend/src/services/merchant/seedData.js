/**
 * seedData.js — DashZW demo merchants (Johannesburg, South Africa)
 *
 * Merchants span multiple categories (restaurant, grocery, pharmacy, etc.).
 * Each merchant is seeded with one default branch and an Owner staff link.
 *
 * TODO(postgresql): Replace JSON seed with SQL migrations / seed scripts.
 */
import { saveCollection, getMeta, setMeta } from '../../db/store.js';
import { ensureDemoUsers } from '../authentication/users.js';
import { MERCHANT_STAFF_ROLES } from '../../domain/merchantStaffRoles.js';

const SHOPS = [
  { name: "Mama's Kitchen", description: "Authentic home-cooked Zimbabwean meals made with love", category: "restaurant", image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80", address: "Vilakazi Street, Soweto", city: "Johannesburg", phone: "+27 11 234 5678", lat: -26.2485, lng: 27.8534, rating: 4.8, estimated_delivery_time: "25-40 min", is_open: true, opening_hours: "7:00 AM - 9:00 PM", owner_email: "mamas@dashzw.com", approval_status: "approved" },
  { name: "Zim Burger Co", description: "Juicy gourmet burgers with local flavours", category: "fast_food", image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80", address: "Rivonia Road, Sandton", city: "Johannesburg", phone: "+27 11 345 6789", lat: -26.1073, lng: 28.0570, rating: 4.5, estimated_delivery_time: "15-25 min", is_open: true, opening_hours: "10:00 AM - 11:00 PM", owner_email: "zimburger@dashzw.com", approval_status: "approved" },
  { name: "Sunrise Bakery", description: "Fresh bread, pastries and cakes baked every morning", category: "bakery", image_url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80", address: "Oxford Road, Rosebank", city: "Johannesburg", phone: "+27 11 456 7890", lat: -26.1465, lng: 28.0427, rating: 4.7, estimated_delivery_time: "10-20 min", is_open: true, opening_hours: "6:00 AM - 6:00 PM", owner_email: "sunrise@dashzw.com", approval_status: "approved" },
  { name: "Chill & Sip", description: "Smoothies, juices, bubble tea and cold drinks", category: "drinks", image_url: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=80", address: "Juta Street, Braamfontein", city: "Johannesburg", phone: "+27 11 567 8901", lat: -26.1950, lng: 28.0410, rating: 4.6, estimated_delivery_time: "10-20 min", is_open: true, opening_hours: "8:00 AM - 10:00 PM", owner_email: "chillsip@dashzw.com", approval_status: "approved" },
  { name: "Sweet Tooth Desserts", description: "Cakes, ice cream, churros and all things sweet", category: "desserts", image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&q=80", address: "7th Street, Melville", city: "Johannesburg", phone: "+27 11 678 9012", lat: -26.1820, lng: 27.9980, rating: 4.9, estimated_delivery_time: "15-25 min", is_open: true, opening_hours: "9:00 AM - 10:00 PM", owner_email: "sweettooth@dashzw.com", approval_status: "approved" },
  { name: "FreshMart Grocery", description: "Everyday groceries, snacks and household essentials", category: "grocery", image_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80", address: "Republic Road, Randburg", city: "Johannesburg", phone: "+27 11 789 0123", lat: -26.0930, lng: 27.9960, rating: 4.3, estimated_delivery_time: "25-45 min", is_open: true, opening_hours: "7:00 AM - 9:00 PM", owner_email: "freshmart@dashzw.com", approval_status: "approved" },
  { name: "CarePlus Pharmacy", description: "Prescriptions, OTC medicine and health essentials", category: "pharmacy", image_url: "https://images.unsplash.com/photo-1585435557343-3b092031a831?w=800&q=80", address: "Jan Smuts Avenue, Parktown", city: "Johannesburg", phone: "+27 11 890 1234", lat: -26.1825, lng: 28.0330, rating: 4.6, estimated_delivery_time: "20-35 min", is_open: true, opening_hours: "8:00 AM - 8:00 PM", owner_email: "careplus@dashzw.com", approval_status: "approved" },
  { name: "QuickStop Convenience", description: "Snacks, drinks and everyday essentials, open late", category: "convenience", image_url: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80", address: "Main Road, Observatory", city: "Johannesburg", phone: "+27 11 901 2345", lat: -26.1740, lng: 28.0850, rating: 4.2, estimated_delivery_time: "15-30 min", is_open: true, opening_hours: "6:00 AM - 12:00 AM", owner_email: "quickstop@dashzw.com", approval_status: "approved" },
];

const MENU_BY_SHOP = [
  [{ name: "Sadza ne Nyama", description: "Traditional sadza with slow-cooked beef stew", price: 85.0, category: "Mains", is_popular: true, image_url: "https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80" }, { name: "Chicken & Sadza", description: "Grilled chicken with sadza and vegetables", price: 95.0, category: "Mains", is_popular: true, image_url: "https://images.unsplash.com/photo-1598103442097-8b74394b95c5?w=400&q=80" }, { name: "Pumpkin Soup", description: "Creamy butternut soup with bread roll", price: 45.0, category: "Starters", is_popular: false, image_url: "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=400&q=80" }, { name: "Maheu", description: "Traditional fermented maize drink, chilled", price: 20.0, category: "Drinks", is_popular: false, image_url: "" }],
  [{ name: "Classic Beef Burger", description: "100g beef patty, lettuce, tomato, house sauce", price: 75.0, category: "Burgers", is_popular: true, image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80" }, { name: "Chicken Burger", description: "Crispy fried chicken fillet with coleslaw", price: 65.0, category: "Burgers", is_popular: true, image_url: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&q=80" }, { name: "Double Stack", description: "Two beef patties, double cheese, bacon, BBQ", price: 110.0, category: "Burgers", is_popular: false, image_url: "" }, { name: "Chips (Regular)", description: "Golden salted fries", price: 25.0, category: "Sides", is_popular: false, image_url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80" }, { name: "Milkshake", description: "Thick shake — chocolate, vanilla or strawberry", price: 40.0, category: "Drinks", is_popular: true, image_url: "" }],
  [{ name: "Butter Croissant", description: "Flaky golden croissant, freshly baked", price: 22.0, category: "Pastries", is_popular: true, image_url: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80" }, { name: "Chocolate Muffin", description: "Rich double chocolate muffin", price: 18.0, category: "Pastries", is_popular: false, image_url: "" }, { name: "White Loaf", description: "Freshly baked white bread loaf (sliced)", price: 28.0, category: "Bread", is_popular: true, image_url: "" }, { name: "Cappuccino", description: "Espresso with steamed milk foam", price: 35.0, category: "Beverages", is_popular: false, image_url: "" }],
  [{ name: "Mango Smoothie", description: "Fresh mango blended with yoghurt and honey", price: 45.0, category: "Smoothies", is_popular: true, image_url: "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400&q=80" }, { name: "Bubble Tea (Taro)", description: "Taro milk tea with tapioca pearls", price: 55.0, category: "Bubble Tea", is_popular: true, image_url: "" }, { name: "Fresh Orange Juice", description: "Freshly squeezed orange juice (400ml)", price: 35.0, category: "Juices", is_popular: false, image_url: "" }, { name: "Watermelon Juice", description: "Pure fresh watermelon juice", price: 35.0, category: "Juices", is_popular: true, image_url: "" }],
  [{ name: "Ice Cream (2 scoops)", description: "Choose from 12 flavours", price: 35.0, category: "Ice Cream", is_popular: true, image_url: "https://images.unsplash.com/photo-1567206563114-c179706a56b5?w=400&q=80" }, { name: "Churros (6 pcs)", description: "Fried dough with cinnamon sugar & choc dip", price: 55.0, category: "Churros", is_popular: true, image_url: "" }, { name: "Chocolate Brownie", description: "Warm fudge brownie with vanilla ice cream", price: 50.0, category: "Baked", is_popular: false, image_url: "" }, { name: "Waffle", description: "Belgian waffle with Nutella and cream", price: 65.0, category: "Waffles", is_popular: false, image_url: "" }],
  [{ name: "Eggs (tray of 30)", description: "Fresh free-range eggs", price: 75.0, category: "Dairy & Eggs", is_popular: true, image_url: "" }, { name: "Full Cream Milk 2L", description: "Full cream fresh milk", price: 38.0, category: "Dairy & Eggs", is_popular: false, image_url: "" }, { name: "Rice 2kg", description: "Long grain white rice", price: 55.0, category: "Grains", is_popular: true, image_url: "" }, { name: "Maize Meal 5kg", description: "Roller meal for pap/sadza", price: 65.0, category: "Grains", is_popular: true, image_url: "" }],
  [{ name: "Pain Relief Pack", description: "Over-the-counter pain relief tablets", price: 45.0, category: "Medicine", is_popular: true, image_url: "" }, { name: "Vitamin C", description: "Immune support tablets (30 pack)", price: 55.0, category: "Vitamins", is_popular: true, image_url: "" }, { name: "First Aid Kit", description: "Basic home first aid kit", price: 120.0, category: "Care", is_popular: false, image_url: "" }],
  [{ name: "Energy Drink", description: "500ml energy drink", price: 22.0, category: "Drinks", is_popular: true, image_url: "" }, { name: "Chips Assorted", description: "Assorted snack chips", price: 18.0, category: "Snacks", is_popular: true, image_url: "" }, { name: "Bottled Water 1L", description: "Still water", price: 12.0, category: "Drinks", is_popular: false, image_url: "" }],
];

const RESET_KEYS = ['Order', 'Wallet', 'Transaction', 'Notification', 'Settlement', 'Withdrawal', 'Referral', 'LoyaltyPoints', 'DriverIncident'];

export function resetTransactionalData() {
  RESET_KEYS.forEach((k) => saveCollection(k, []));
  console.log('[DashZW] All transactional data reset.');
}

export function seedDatabase() {
  const SEED_VERSION = 'dashzw_v9_merchant';
  if (getMeta('seeded') === SEED_VERSION) return;

  ensureDemoUsers();

  const now = new Date();
  const shopRecords = SHOPS.map((shop, idx) => {
    const id = `shop${idx + 1}_${(now.getTime() + idx).toString(36)}`;
    const branchId = `branch${idx + 1}_${(now.getTime() + idx).toString(36)}`;
    const ts = new Date(now - (SHOPS.length - idx) * 60000).toISOString();
    return {
      ...shop,
      id,
      // Domain aliases (Merchant = Shop document)
      default_branch_id: branchId,
      created_date: ts,
      updated_date: ts,
    };
  });
  saveCollection('Shop', shopRecords);

  // One default branch per merchant (architecture supports many branches)
  const branchRecords = shopRecords.map((shop) => ({
    id: shop.default_branch_id,
    merchant_id: shop.id,
    shop_id: shop.id,
    name: 'Main',
    address: shop.address,
    city: shop.city,
    phone: shop.phone,
    lat: shop.lat,
    lng: shop.lng,
    is_open: shop.is_open,
    opening_hours: shop.opening_hours,
    estimated_delivery_time: shop.estimated_delivery_time,
    is_default: true,
    created_date: shop.created_date,
    updated_date: shop.updated_date,
  }));
  saveCollection('Branch', branchRecords);

  // Owner staff link for each merchant (partner user = Owner)
  const staffRecords = shopRecords.map((shop, idx) => ({
    id: `staff${idx + 1}_${(now.getTime() + idx).toString(36)}`,
    merchant_id: shop.id,
    shop_id: shop.id,
    branch_id: null, // all branches
    user_email: shop.owner_email,
    staff_role: MERCHANT_STAFF_ROLES.OWNER,
    is_active: true,
    created_date: shop.created_date,
    updated_date: shop.updated_date,
  }));
  saveCollection('MerchantStaff', staffRecords);

  const allItems = [];
  shopRecords.forEach((shop, sIdx) => {
    (MENU_BY_SHOP[sIdx] || []).forEach((item, mIdx) => {
      const id = `item${sIdx}_${mIdx}_${(now.getTime() + mIdx).toString(36)}`;
      allItems.push({
        ...item,
        id,
        shop_id: shop.id,
        merchant_id: shop.id,
        branch_id: shop.default_branch_id,
        is_available: true,
        created_date: new Date(now - mIdx * 1000).toISOString(),
        updated_date: new Date(now - mIdx * 1000).toISOString(),
      });
    });
  });

  saveCollection('MenuItem', allItems);
  ['Order', 'Review', 'Promotion', 'Wallet', 'Transaction', 'DriverProfile', 'Notification'].forEach((k) =>
    saveCollection(k, [])
  );
  saveCollection('AdminPromotion', []);
  saveCollection('Settlement', []);
  saveCollection('Withdrawal', []);
  setMeta('seeded', SEED_VERSION);
  console.log(
    '[DashZW] Seeded merchants:',
    shopRecords.length,
    'branches:',
    branchRecords.length,
    'products:',
    allItems.length
  );
}

export function resetOrderData() {
  ['Order', 'Wallet', 'Transaction', 'Notification', 'Review', 'Settlement', 'Withdrawal', 'Referral', 'LoyaltyPoints', 'DriverIncident'].forEach((k) =>
    saveCollection(k, [])
  );
  saveCollection('DriverProfile', []);
  console.log('[DashZW] Order data reset.');
}

export function factoryReset() {
  setMeta('seeded', null);
  seedDatabase();
}
