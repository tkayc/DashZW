-- =============================================================================
-- DashZW catalog seed — merchants, branches, staff, products
-- Run in pgAdmin while connected to database "dashzw" (after 001 schema).
-- Safe to re-run (ON CONFLICT DO NOTHING / DO UPDATE).
-- =============================================================================

BEGIN;

-- Merchants first (no default_branch_id yet — avoids FK order issues)
INSERT INTO merchants (
  id, name, description, category_id, image_url, address, city, phone,
  lat, lng, rating, estimated_delivery_time, is_open, opening_hours,
  owner_email, approval_status, verification_status
) VALUES
('mrc_mamas', 'Mama''s Kitchen', 'Authentic home-cooked Zimbabwean meals made with love', 'restaurant',
 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
 'Vilakazi Street, Soweto', 'Johannesburg', '+27 11 234 5678', -26.2485, 27.8534, 4.8, '25-40 min', TRUE, '7:00 AM - 9:00 PM',
 'mamas@dashzw.com', 'approved', 'verified'),
('mrc_zimburger', 'Zim Burger Co', 'Juicy gourmet burgers with local flavours', 'fast_food',
 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
 'Rivonia Road, Sandton', 'Johannesburg', '+27 11 345 6789', -26.1073, 28.0570, 4.5, '15-25 min', TRUE, '10:00 AM - 11:00 PM',
 'zimburger@dashzw.com', 'approved', 'verified'),
('mrc_sunrise', 'Sunrise Bakery', 'Fresh bread, pastries and cakes baked every morning', 'bakery',
 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80',
 'Oxford Road, Rosebank', 'Johannesburg', '+27 11 456 7890', -26.1465, 28.0427, 4.7, '10-20 min', TRUE, '6:00 AM - 6:00 PM',
 'sunrise@dashzw.com', 'approved', 'verified'),
('mrc_chillsip', 'Chill & Sip', 'Smoothies, juices, bubble tea and cold drinks', 'drinks',
 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=80',
 'Juta Street, Braamfontein', 'Johannesburg', '+27 11 567 8901', -26.1950, 28.0410, 4.6, '10-20 min', TRUE, '8:00 AM - 10:00 PM',
 'chillsip@dashzw.com', 'approved', 'verified'),
('mrc_sweettooth', 'Sweet Tooth Desserts', 'Cakes, ice cream, churros and all things sweet', 'desserts',
 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&q=80',
 '7th Street, Melville', 'Johannesburg', '+27 11 678 9012', -26.1820, 27.9980, 4.9, '15-25 min', TRUE, '9:00 AM - 10:00 PM',
 'sweettooth@dashzw.com', 'approved', 'verified'),
('mrc_freshmart', 'FreshMart Grocery', 'Everyday groceries, snacks and household essentials', 'grocery',
 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80',
 'Republic Road, Randburg', 'Johannesburg', '+27 11 789 0123', -26.0930, 27.9960, 4.3, '25-45 min', TRUE, '7:00 AM - 9:00 PM',
 'freshmart@dashzw.com', 'approved', 'verified'),
('mrc_careplus', 'CarePlus Pharmacy', 'Prescriptions, OTC medicine and health essentials', 'pharmacy',
 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=800&q=80',
 'Jan Smuts Avenue, Parktown', 'Johannesburg', '+27 11 890 1234', -26.1825, 28.0330, 4.6, '20-35 min', TRUE, '8:00 AM - 8:00 PM',
 'careplus@dashzw.com', 'approved', 'verified'),
('mrc_quickstop', 'QuickStop Convenience', 'Snacks, drinks and everyday essentials, open late', 'convenience',
 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80',
 'Main Road, Observatory', 'Johannesburg', '+27 11 901 2345', -26.1740, 28.0850, 4.2, '15-30 min', TRUE, '6:00 AM - 12:00 AM',
 'quickstop@dashzw.com', 'approved', 'verified')
ON CONFLICT (id) DO UPDATE SET
  approval_status = EXCLUDED.approval_status,
  name = EXCLUDED.name,
  updated_at = NOW();

INSERT INTO merchant_branches (
  id, merchant_id, name, address, city, phone, lat, lng, operating_hours,
  estimated_delivery_time, status, is_open, is_default, manager_email, delivery_radius_km
) VALUES
('brn_mamas', 'mrc_mamas', 'Main', 'Vilakazi Street, Soweto', 'Johannesburg', '+27 11 234 5678', -26.2485, 27.8534, '7:00 AM - 9:00 PM', '25-40 min', 'open', TRUE, TRUE, 'mamas@dashzw.com', 8),
('brn_zimburger', 'mrc_zimburger', 'Main', 'Rivonia Road, Sandton', 'Johannesburg', '+27 11 345 6789', -26.1073, 28.0570, '10:00 AM - 11:00 PM', '15-25 min', 'open', TRUE, TRUE, 'zimburger@dashzw.com', 8),
('brn_sunrise', 'mrc_sunrise', 'Main', 'Oxford Road, Rosebank', 'Johannesburg', '+27 11 456 7890', -26.1465, 28.0427, '6:00 AM - 6:00 PM', '10-20 min', 'open', TRUE, TRUE, 'sunrise@dashzw.com', 8),
('brn_chillsip', 'mrc_chillsip', 'Main', 'Juta Street, Braamfontein', 'Johannesburg', '+27 11 567 8901', -26.1950, 28.0410, '8:00 AM - 10:00 PM', '10-20 min', 'open', TRUE, TRUE, 'chillsip@dashzw.com', 8),
('brn_sweettooth', 'mrc_sweettooth', 'Main', '7th Street, Melville', 'Johannesburg', '+27 11 678 9012', -26.1820, 27.9980, '9:00 AM - 10:00 PM', '15-25 min', 'open', TRUE, TRUE, 'sweettooth@dashzw.com', 8),
('brn_freshmart', 'mrc_freshmart', 'Main', 'Republic Road, Randburg', 'Johannesburg', '+27 11 789 0123', -26.0930, 27.9960, '7:00 AM - 9:00 PM', '25-45 min', 'open', TRUE, TRUE, 'freshmart@dashzw.com', 8),
('brn_careplus', 'mrc_careplus', 'Main', 'Jan Smuts Avenue, Parktown', 'Johannesburg', '+27 11 890 1234', -26.1825, 28.0330, '8:00 AM - 8:00 PM', '20-35 min', 'open', TRUE, TRUE, 'careplus@dashzw.com', 8),
('brn_quickstop', 'mrc_quickstop', 'Main', 'Main Road, Observatory', 'Johannesburg', '+27 11 901 2345', -26.1740, 28.0850, '6:00 AM - 12:00 AM', '15-30 min', 'open', TRUE, TRUE, 'quickstop@dashzw.com', 8)
ON CONFLICT (id) DO NOTHING;

UPDATE merchants SET default_branch_id = 'brn_mamas' WHERE id = 'mrc_mamas';
UPDATE merchants SET default_branch_id = 'brn_zimburger' WHERE id = 'mrc_zimburger';
UPDATE merchants SET default_branch_id = 'brn_sunrise' WHERE id = 'mrc_sunrise';
UPDATE merchants SET default_branch_id = 'brn_chillsip' WHERE id = 'mrc_chillsip';
UPDATE merchants SET default_branch_id = 'brn_sweettooth' WHERE id = 'mrc_sweettooth';
UPDATE merchants SET default_branch_id = 'brn_freshmart' WHERE id = 'mrc_freshmart';
UPDATE merchants SET default_branch_id = 'brn_careplus' WHERE id = 'mrc_careplus';
UPDATE merchants SET default_branch_id = 'brn_quickstop' WHERE id = 'mrc_quickstop';

-- Link owner users + staff
UPDATE merchants m SET owner_user_id = u.id
FROM users u WHERE u.email = m.owner_email AND m.owner_user_id IS NULL;

INSERT INTO merchant_staff (id, merchant_id, user_id, user_email, staff_role, is_active)
SELECT 'stf_' || m.id, m.id, u.id, m.owner_email, 'owner', TRUE
FROM merchants m
JOIN users u ON u.email = m.owner_email
ON CONFLICT (merchant_id, user_email) DO NOTHING;

INSERT INTO merchant_branding (merchant_id, logo_url, cover_url, tagline)
SELECT id, image_url, image_url, description FROM merchants
ON CONFLICT (merchant_id) DO NOTHING;

-- Sample products (subset per merchant)
INSERT INTO products (id, merchant_id, branch_id, category_name, name, description, price, image_url, is_popular, is_available) VALUES
('prd_mamas_1', 'mrc_mamas', 'brn_mamas', 'Mains', 'Sadza ne Nyama', 'Traditional sadza with slow-cooked beef stew', 85, 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80', TRUE, TRUE),
('prd_mamas_2', 'mrc_mamas', 'brn_mamas', 'Mains', 'Chicken & Sadza', 'Grilled chicken with sadza and vegetables', 95, 'https://images.unsplash.com/photo-1598103442097-8b74394b95c5?w=400&q=80', TRUE, TRUE),
('prd_mamas_3', 'mrc_mamas', 'brn_mamas', 'Starters', 'Pumpkin Soup', 'Creamy butternut soup with bread roll', 45, 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=400&q=80', FALSE, TRUE),
('prd_zim_1', 'mrc_zimburger', 'brn_zimburger', 'Burgers', 'Classic Beef Burger', '100g beef patty, lettuce, tomato, house sauce', 75, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80', TRUE, TRUE),
('prd_zim_2', 'mrc_zimburger', 'brn_zimburger', 'Burgers', 'Chicken Burger', 'Crispy fried chicken fillet with coleslaw', 65, 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&q=80', TRUE, TRUE),
('prd_zim_3', 'mrc_zimburger', 'brn_zimburger', 'Sides', 'Chips (Regular)', 'Golden salted fries', 25, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80', FALSE, TRUE),
('prd_sun_1', 'mrc_sunrise', 'brn_sunrise', 'Pastries', 'Butter Croissant', 'Flaky golden croissant, freshly baked', 22, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80', TRUE, TRUE),
('prd_sun_2', 'mrc_sunrise', 'brn_sunrise', 'Bread', 'White Loaf', 'Freshly baked white bread loaf (sliced)', 28, NULL, TRUE, TRUE),
('prd_chill_1', 'mrc_chillsip', 'brn_chillsip', 'Smoothies', 'Mango Smoothie', 'Fresh mango blended with yoghurt and honey', 45, 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400&q=80', TRUE, TRUE),
('prd_sweet_1', 'mrc_sweettooth', 'brn_sweettooth', 'Ice Cream', 'Ice Cream (2 scoops)', 'Choose from 12 flavours', 35, 'https://images.unsplash.com/photo-1567206563114-c179706a56b5?w=400&q=80', TRUE, TRUE),
('prd_fresh_1', 'mrc_freshmart', 'brn_freshmart', 'Dairy & Eggs', 'Eggs (tray of 30)', 'Fresh free-range eggs', 75, NULL, TRUE, TRUE),
('prd_fresh_2', 'mrc_freshmart', 'brn_freshmart', 'Grains', 'Maize Meal 5kg', 'Roller meal for pap/sadza', 65, NULL, TRUE, TRUE),
('prd_care_1', 'mrc_careplus', 'brn_careplus', 'Medicine', 'Pain Relief Pack', 'Over-the-counter pain relief tablets', 45, NULL, TRUE, TRUE),
('prd_quick_1', 'mrc_quickstop', 'brn_quickstop', 'Drinks', 'Energy Drink', '500ml energy drink', 22, NULL, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Inventory rows
INSERT INTO inventory (id, merchant_id, branch_id, product_id, quantity, low_stock_threshold)
SELECT 'inv_' || p.id, p.merchant_id, p.branch_id, p.id, 50, 5
FROM products p
WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id);

-- Platform wallets for partners
INSERT INTO wallets (id, owner_email, owner_type, owner_user_id, balance)
SELECT 'wal_' || u.id, u.email, 'partner', u.id, 0
FROM users u WHERE u.role IN ('partner', 'merchant_owner')
ON CONFLICT (owner_email, owner_type) DO NOTHING;

INSERT INTO wallets (id, owner_email, owner_type, owner_user_id, balance)
SELECT 'wal_' || u.id, u.email, 'driver', u.id, 0
FROM users u WHERE u.role = 'driver'
ON CONFLICT (owner_email, owner_type) DO NOTHING;

INSERT INTO wallets (id, owner_email, owner_type, owner_user_id, balance)
SELECT 'wal_' || u.id, u.email, 'customer', u.id, 25
FROM users u WHERE u.role = 'customer'
ON CONFLICT (owner_email, owner_type) DO UPDATE SET balance = GREATEST(wallets.balance, EXCLUDED.balance);

-- Sample admin promo
INSERT INTO admin_promotions (id, title, promo_type, coupon_code, discount_value, min_order, is_active, new_users_only)
VALUES ('aprm_welcome', 'First order R30 off', 'new_user_discount', 'WELCOME30', 30, 50, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app_meta (key, value) VALUES ('catalog_seeded', '002')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;

-- Verify
SELECT 'merchants' AS entity, COUNT(*)::text AS count FROM merchants
UNION ALL SELECT 'products', COUNT(*)::text FROM products
UNION ALL SELECT 'branches', COUNT(*)::text FROM merchant_branches
UNION ALL SELECT 'users', COUNT(*)::text FROM users;
