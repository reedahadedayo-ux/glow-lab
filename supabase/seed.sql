-- Insert-only seed for the user-approved NEW GlowLab demo project.
BEGIN;
INSERT INTO glowlab.categories(name) VALUES ('Cleansers'),('Moisturizers'),('Sunscreens'),('Serums'),('Exfoliants'),('Treatments') ON CONFLICT (name) DO NOTHING;
INSERT INTO glowlab.products(id,name,brand,price,image,category,skin_type,description,ingredients,usage,details_verified,available,stock) VALUES
('cerave-foaming','CeraVe Foaming Facial Cleanser','CeraVe',14500,'cerave-foaming-cleanser.jpg','Cleansers','Oily, Combination','CeraVe cleanser from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('cetaphil-gentle','Cetaphil Gentle Skin Cleanser','Cetaphil',13200,'cetaphil-cleanser.jpg','Cleansers','Sensitive, Dry','Cetaphil cleanser from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('cerave-cream','CeraVe Moisturizing Cream','CeraVe',17800,'cerave-moisturizing-cream.jpg','Moisturizers','Dry, Sensitive','CeraVe moisturizer from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('neutrogena-hydro','Neutrogena Hydro Boost Water Gel','Neutrogena',12500,'neutrogena-hydro-boost.jpg','Moisturizers','Oily, Combination','Neutrogena moisturizer from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('boj-relief-sun','Beauty of Joseon Relief Sun SPF50+','Beauty of Joseon',15200,'beauty-of-joseon-relief-sun.jpg','Sunscreens','All Skin Types','Beauty of Joseon sunscreen from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('lrp-anthelios','La Roche-Posay Anthelios SPF50+','La Roche-Posay',18900,'lrp-anthelios.jpg','Sunscreens','Sensitive, Oily','La Roche-Posay sunscreen from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('eucerin-oil-control','Eucerin Oil Control SPF50+','Eucerin',16300,'eucerin-oil-control.jpg','Sunscreens','Oily, Acne-Prone','Eucerin sunscreen from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('ordinary-niacinamide','The Ordinary Niacinamide 10% + Zinc','The Ordinary',9800,'the-ordinary-niacinamide.jpg','Serums','Oily, Combination','The Ordinary serum from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('cosrx-snail','COSRX Snail Mucin Essence','COSRX',14200,'cosrx-snail-mucin.jpg','Serums','Dry, Dull, Sensitive','COSRX serum from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('garnier-vitc','Garnier Vitamin C Serum','Garnier',8900,'garnier-vitamin-c.jpg','Serums','All, Dull','Garnier serum from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('paulas-bha','Paula’s Choice 2% BHA Liquid Exfoliant','Paula’s Choice',21500,'paulas-choice-bha.jpg','Exfoliants','Oily, Acne-Prone, Combo','Paula’s Choice exfoliant from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('skin1004-centella','Skin1004 Centella Ampoule','Skin1004',13800,'skin1004-centella.jpg','Treatments','Sensitive, Acne-Prone','Skin1004 treatment from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO glowlab.store_policies(slug,title,content,published) VALUES
('delivery','Demo delivery','This is a demonstration. No products are physically dispatched. The original storefront described Lagos delivery in 1–3 business days and outside Lagos in 3–7 business days; these are illustrative, not a shipping commitment. Demo delivery fee is ₦0. No courier tracking, SMS or email is sent.',true),
('returns','Demo returns','The original demo policy allows unopened products in original packaging within 7 days of delivery. Opened skincare is excluded unless damaged in transit. Report damage within 48 hours. In this demo, submit a support ticket; no physical return is processed.',true),
('refunds','Demo refunds','No money is collected, so no monetary refund can be issued. A refund request can be recorded as a support ticket. No real-world refund time frame is published.',true),
('cancellation','Demo cancellation','Ask Lumi or use Contact to record a cancellation request. A request does not automatically change an order status. No real-world cancellation deadline is published.',true),
('payment','Simulated payment only','Checkout creates a demo order with payment_status paid, payment_method simulated and order_status confirmed. No real money is charged. Do not enter card or bank details.',true),
('privacy','Demo data and privacy','Use fictional delivery details for this demo. Orders are accessible only from the browser session that created them, with the checkout email for order lookup. Losing the browser session requires support; email alone does not unlock an order. Lumi messages are sent to Google Gemini to answer your request. Do not share sensitive medical or payment information. Cart data stays in your browser. Support tickets and demo orders are saved in the configured database. No marketing emails are sent.',true)
ON CONFLICT (slug) DO NOTHING;
COMMIT;
