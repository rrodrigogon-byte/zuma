ALTER TABLE commerce_store_domains
  ADD COLUMN IF NOT EXISTS verification_token VARCHAR(128);

UPDATE commerce_store_domains
   SET verification_token = encode(gen_random_bytes(24), 'hex')
 WHERE verification_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_domain_verification_token
  ON commerce_store_domains (verification_token)
 WHERE verification_token IS NOT NULL;
