-- Run in pgAdmin on database: dashzw
-- Converts catalog prices to USD, adds sample pizza variants/add-ons, and a demo driver job.

-- Normalize existing seed prices to USD (prior seed used local-scale numbers)
UPDATE products SET price = ROUND(price / 10.0, 2) WHERE price >= 10;

UPDATE merchants SET min_order_amount = ROUND(COALESCE(min_order_amount, 0) / 10.0, 2) WHERE min_order_amount >= 10;

UPDATE platform_config SET value = '{"amount": 2.50, "currency": "USD"}'::jsonb WHERE key = 'base_delivery_fee';

-- Sample configurable pizza with sizes and add-ons (Zim Burger Co)
INSERT INTO products (id, merchant_id, branch_id, category_name, name, description, price, image_url, is_popular, is_available)
VALUES (
  'prd_pizza_margherita',
  'mrc_zimburger',
  'brn_zimburger',
  'Pizza',
  'Margherita Pizza',
  'Tomato, mozzarella, basil — pick your size and add extras',
  11.99,
  'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80',
  TRUE,
  TRUE
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  category_name = EXCLUDED.category_name;

DELETE FROM product_variants WHERE product_id = 'prd_pizza_margherita';
INSERT INTO product_variants (id, product_id, name, price_delta, is_default, is_available) VALUES
  ('pvar_pizza_sm', 'prd_pizza_margherita', 'Small (10")', 0, TRUE, TRUE),
  ('pvar_pizza_md', 'prd_pizza_margherita', 'Medium (12")', 3.00, FALSE, TRUE),
  ('pvar_pizza_lg', 'prd_pizza_margherita', 'Large (14")', 5.50, FALSE, TRUE);

DELETE FROM product_addons WHERE product_id = 'prd_pizza_margherita';
INSERT INTO product_addons (id, product_id, name, price, is_available) VALUES
  ('padd_cheese', 'prd_pizza_margherita', 'Extra cheese', 1.50, TRUE),
  ('padd_pepperoni', 'prd_pizza_margherita', 'Extra pepperoni', 2.50, TRUE),
  ('padd_mushroom', 'prd_pizza_margherita', 'Extra mushrooms', 1.25, TRUE);

DELETE FROM product_images WHERE product_id = 'prd_pizza_margherita';
INSERT INTO product_images (id, product_id, url, sort_order) VALUES
  ('pimg_pizza_1', 'prd_pizza_margherita', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80', 0),
  ('pimg_pizza_2', 'prd_pizza_margherita', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80', 1);

-- Demo order ready for driver pickup (visible on Available Jobs)
INSERT INTO orders (
  id, customer_email, customer_name, customer_phone,
  merchant_id, merchant_name, shop_id, shop_name, shop_address,
  partner_email, status, is_pickup,
  delivery_address, delivery_city, delivery_code,
  payment_method, partner_subtotal, platform_fee, customer_subtotal,
  delivery_fee, raw_delivery_fee, service_fee, total,
  partner_payout, platform_earning, driver_earning, distance_km
) VALUES (
  'ord_demo_driver_job',
  'customer@demo.com',
  'Alex Customer',
  '+1 555 0100',
  'mrc_zimburger',
  'Zim Burger Co',
  'mrc_zimburger',
  'Zim Burger Co',
  'Sam Nujoma Street, Harare',
  'zimburger@dashzw.com',
  'ready_for_pickup',
  FALSE,
  '12 Borrowdale Road, Harare',
  'Harare',
  '4829',
  'ecocash',
  18.49, 0.92, 19.41,
  3.99, 3.99, 0.20, 23.60,
  17.57, 1.23, 4.19, 4.2
) ON CONFLICT (id) DO UPDATE SET status = 'ready_for_pickup', driver_email = NULL, updated_at = NOW();

DELETE FROM order_items WHERE order_id = 'ord_demo_driver_job';
INSERT INTO order_items (order_id, product_id, menu_item_id, name, price, quantity, variant_name, addon_names)
VALUES
  ('ord_demo_driver_job', 'prd_zim_1', 'prd_zim_1', 'Classic Beef Burger', 7.50, 1, NULL, '[]'::jsonb),
  ('ord_demo_driver_job', 'prd_pizza_margherita', 'prd_pizza_margherita', 'Margherita Pizza (Medium)', 14.99, 1, 'Medium (12")', '["Extra cheese"]'::jsonb);
