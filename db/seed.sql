-- seed.sql — demo data for PrintShop Pro
-- Passwords are bcrypt-hashed via pgcrypto. Demo password for ALL users: printshop2026

-- ---------- USERS ----------
INSERT INTO users (first_name, surname, email, password_hash, role_label, is_owner) VALUES
  ('Thandiwe','Mokoena','thandiwe@printshoppro.co.za', crypt('printshop2026', gen_salt('bf',10)), 'Owner · Admin',   TRUE),
  ('Sipho','Ndlovu',     'sipho@printshoppro.co.za',    crypt('printshop2026', gen_salt('bf',10)), 'Front-of-house',  FALSE),
  ('Lerato','Dlamini',   'lerato@printshoppro.co.za',   crypt('printshop2026', gen_salt('bf',10)), 'Production',      FALSE),
  ('Pieter','van Wyk',   'pieter@printshoppro.co.za',   crypt('printshop2026', gen_salt('bf',10)), 'Design',          FALSE);

-- Owner gets all 16 permissions.
INSERT INTO user_permissions (user_id, permission_key, granted)
SELECT u.id, p.key, TRUE
FROM users u CROSS JOIN permissions p
WHERE u.is_owner = TRUE;

-- Sipho (front-of-house): ops + customer/whatsapp + quotes, NO finance view.
INSERT INTO user_permissions (user_id, permission_key, granted)
SELECT u.id, k, TRUE FROM users u,
  unnest(ARRAY['dashboard.view','orders.create','orders.edit','proofing.manage',
               'deliveries.manage','quotes.create','customers.manage','whatsapp.send','dashboard.view']) k
WHERE u.email = 'sipho@printshoppro.co.za'
ON CONFLICT DO NOTHING;

-- Lerato (production): ops focused.
INSERT INTO user_permissions (user_id, permission_key, granted)
SELECT u.id, k, TRUE FROM users u,
  unnest(ARRAY['dashboard.view','orders.create','orders.edit','proofing.manage',
               'stock.manage','deliveries.manage','customers.manage']) k
WHERE u.email = 'lerato@printshoppro.co.za'
ON CONFLICT DO NOTHING;

-- Pieter (design): proofing + orders + finance view.
INSERT INTO user_permissions (user_id, permission_key, granted)
SELECT u.id, k, TRUE FROM users u,
  unnest(ARRAY['dashboard.view','orders.create','orders.edit','proofing.manage',
               'finance.view','quotes.create','customers.manage','whatsapp.send']) k
WHERE u.email = 'pieter@printshoppro.co.za'
ON CONFLICT DO NOTHING;

-- ---------- CUSTOMERS ----------
INSERT INTO customers (type, first_name, surname, company_name, email, phone, address_line1, suburb, city, postal_code, vat_number, created_by)
SELECT * FROM (VALUES
  ('company'::customer_type,'Naledi','Khumalo','Naledi Stationers','naledi@stationers.co.za','+27824410192','12 Commissioner St','Marshalltown','Johannesburg','2001','4210198765'),
  ('company'::customer_type,'Khanya','Dube','Khanya Events','hello@khanyaevents.co.za','+27712208847','88 Vilakazi St','Orlando West','Soweto','1804','4330456789'),
  ('company'::customer_type,'James','Oliver','Durban Surf Club','admin@dbnsurf.co.za','+27839901123','5 Marine Parade','North Beach','Durban','4001',NULL),
  ('company'::customer_type,'Bongani','Mahlangu','Soweto Eats','orders@sowetoeats.co.za','+27607783340','21 Klipspruit Rd','Pimville','Soweto','1809','4445567231'),
  ('individual'::customer_type,'Lerato','Pillay',NULL,'lerato.pillay@gmail.com','+27828845512','7 Oak Avenue','Rondebosch','Cape Town','7700',NULL)
) v
CROSS JOIN LATERAL (SELECT id FROM users WHERE is_owner LIMIT 1) o(created_by);

-- ---------- QUOTES ----------
INSERT INTO quotes (quote_number, customer_id, description, status, subtotal, vat_amount, total, valid_until, created_by)
SELECT q.qn, c.id, q.descr, q.st::quote_status, q.sub, q.vat, q.tot, current_date + 14,
       (SELECT id FROM users WHERE is_owner LIMIT 1)
FROM (VALUES
  ('QUO-0451','Naledi Stationers','Roll-up + flyers bundle','sent',     7521.74,1128.26, 8650.00),
  ('QUO-0449','Khanya Events','Loyalty cards ×500','accepted',          1260.87, 189.13, 1450.00),
  ('QUO-0448','Durban Surf Club','Exhibition wall','sent',             20782.61,3117.39,23900.00),
  ('QUO-0447','Soweto Eats','Seed packet labels','expired',             2782.61, 417.39, 3200.00)
) q(qn,cust,descr,st,sub,vat,tot)
JOIN customers c ON customer_display_name(c) = q.cust;

-- ---------- ORDERS ----------
INSERT INTO orders (order_number, customer_id, description, status, subtotal, vat_amount, total, deposit_amount, order_date, due_date, created_by, assigned_to)
SELECT o.onum, c.id, o.descr, o.st::order_status, o.sub, o.vat, o.tot, o.dep,
       current_date - (o.age||' days')::interval, current_date + 3,
       (SELECT id FROM users WHERE role_label='Production' LIMIT 1),
       (SELECT id FROM users WHERE role_label = o.assignee LIMIT 1)
FROM (VALUES
  ('ORD-2087','Naledi Stationers','500× A1 Posters','in_production',11130.43,1669.57,12800.00,6400.00,2,'Production'),
  ('ORD-2086','Durban Surf Club','3× Pull-up Banners','proofing',     3782.61, 567.39, 4350.00,2175.00,1,'Design'),
  ('ORD-2085','Soweto Eats','1000× Business Cards','ready',            1434.78, 215.22, 1650.00, 825.00,3,'Production'),
  ('ORD-2082','Khanya Events','200× Wedding Invites','proofing',       6434.78, 965.22, 7400.00,3700.00,4,'Design')
) o(onum,cust,descr,st,sub,vat,tot,dep,age,assignee)
JOIN customers c ON customer_display_name(c) = o.cust;

-- ---------- INVOICES ----------
INSERT INTO invoices (invoice_number, customer_id, order_id, status, subtotal, vat_amount, total, issue_date, due_date, created_by)
SELECT v.inum, c.id, ord.id, 'sent'::invoice_status, v.sub, v.vat, v.tot,
       (current_date - (v.age||' days')::interval)::date,
       (current_date - (v.age||' days')::interval)::date + 14,
       (SELECT id FROM users WHERE is_owner LIMIT 1)
FROM (VALUES
  ('INV-1192','Naledi Stationers','ORD-2087',11130.43,1669.57,12800.00, 0),
  ('INV-1191','Khanya Events',     'ORD-2082', 6434.78, 965.22, 7400.00, 2),
  ('INV-1190','Durban Surf Club',  'ORD-2086', 7930.43,1189.57, 9120.00,20)
) v(inum,cust,onum,sub,vat,tot,age)
JOIN customers c ON customer_display_name(c) = v.cust
LEFT JOIN orders ord ON ord.order_number = v.onum;

-- ---------- PAYMENTS ----------
INSERT INTO payments (reference, invoice_id, type, method, amount, bank_ref, paid_at, created_by)
SELECT p.ref, i.id, p.ty::payment_type, p.meth::payment_method, p.amt, p.bref,
       current_date - (p.age||' days')::interval,
       (SELECT id FROM users WHERE is_owner LIMIT 1)
FROM (VALUES
  ('PMT-3310','INV-1192','payment','eft', 12800.00,'FNB-EFT-77120', 0),
  ('PMT-3309','INV-1191','deposit','card', 3700.00,'CARD-99821',     2)
) p(ref,inum,ty,meth,amt,bref,age)
JOIN invoices i ON i.invoice_number = p.inum;

-- ---------- PROOFS ----------
INSERT INTO proofs (order_id, filename, version, status, created_by)
SELECT o.id, pf.fn, pf.v, pf.st::proof_status, (SELECT id FROM users WHERE role_label='Design' LIMIT 1)
FROM (VALUES
  ('ORD-2086','Banner_v2.pdf',2,'awaiting'),
  ('ORD-2082','Invite_v3.pdf',3,'awaiting'),
  ('ORD-2085','Card_v1.pdf',1,'approved')
) pf(onum,fn,v,st)
JOIN orders o ON o.order_number = pf.onum;

-- ---------- STOCK ----------
INSERT INTO stock_items (name, category, sku, on_hand, reorder_at, unit_cost) VALUES
  ('Gloss 170gsm A1','PAPER','SUP-GLO170',420,80,12.40),
  ('Matte Vinyl Roll','VINYL','SUP-VNL01',3,5,540.00),
  ('Cyan Ink 1L','INK','SUP-INKC',12,4,310.00),
  ('Banner Eyelets','HARDWARE','SUP-EYL',0,200,0.85),
  ('Lamination Film','FILM','SUP-LAM',7,6,180.00),
  ('A3 Wooden Frame','HARDWARE','SUP-FRMA3',48,10,45.00),
  ('Canvas Sheet','FILM','SUP-CNV01',250,40,18.50);

-- ---------- PRODUCTS ----------
INSERT INTO products (name, price, created_by)
SELECT p.name, p.price, (SELECT id FROM users WHERE is_owner LIMIT 1)
FROM (VALUES
  ('A3 Canvas Print', 450.00),
  ('A1 Poster Print', 180.00)
) p(name, price);

INSERT INTO product_materials (product_id, stock_item_id, quantity)
SELECT pr.id, s.id, m.qty
FROM (VALUES
  ('A3 Canvas Print','A3 Wooden Frame',1),
  ('A3 Canvas Print','Canvas Sheet',100),
  ('A1 Poster Print','Gloss 170gsm A1',1),
  ('A1 Poster Print','Cyan Ink 1L',0.05)
) m(product, stock, qty)
JOIN products pr ON pr.name = m.product
JOIN stock_items s ON s.name = m.stock;

-- ---------- DELIVERIES ----------
INSERT INTO deliveries (reference, order_id, carrier, tracking_ref, status, scheduled_for, created_by)
SELECT d.ref, o.id, d.carrier, d.trk, d.st::delivery_status, current_date + 1,
       (SELECT id FROM users WHERE role_label='Front-of-house' LIMIT 1)
FROM (VALUES
  ('DLV-0088','ORD-2085','Own Driver — Lerato','JHB-CBD','in_transit'),
  ('DLV-0087','ORD-2086','Pargo Pickup','CPT-7700','awaiting')
) d(ref,onum,carrier,trk,st)
JOIN orders o ON o.order_number = d.onum;

-- ---------- WHATSAPP ----------
INSERT INTO whatsapp_messages (customer_id, template, body, status, created_by)
SELECT c.id, w.tmpl, w.body, w.st::wa_status, (SELECT id FROM users WHERE role_label='Front-of-house' LIMIT 1)
FROM (VALUES
  ('Naledi Stationers','order_in_production','Your order ORD-2087 is now in production.','delivered'),
  ('Khanya Events','proof_ready','Proof ready for ORD-2082 — please review & approve.','read'),
  ('Durban Surf Club','payment_reminder','Friendly reminder: INV-1190 is now overdue.','sent')
) w(cust,tmpl,body,st)
JOIN customers c ON customer_display_name(c) = w.cust;
