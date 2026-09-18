-- Keep package pricing consistent with the public /packages page.
-- Standard rates are per class.

UPDATE package_plans
SET price = CASE class_count
    WHEN 25 THEN CASE WHEN currency = 'INR' THEN 2000.00 ELSE 20.00 END
    WHEN 50 THEN CASE WHEN currency = 'INR' THEN 1950.00 ELSE 19.50 END
    WHEN 75 THEN CASE WHEN currency = 'INR' THEN 1900.00 ELSE 19.00 END
    WHEN 100 THEN CASE WHEN currency = 'INR' THEN 1850.00 ELSE 18.50 END
    ELSE price
END,
updated_at = now()
WHERE is_custom = false
  AND currency IN ('INR', 'USD')
  AND class_count IN (25, 50, 75, 100);

-- Custom packages use the same per-class rate as the 25-class package.
-- class_count is set to 25 because the current package model requires a minimum
-- of 25 classes; the custom flag identifies the plan as flexible in the UI.
INSERT INTO package_plans (name, description, class_count, price, currency, is_custom, is_active)
SELECT 'Customize Your Package',
       'Build a package around your required number of classes.',
       25,
       CASE WHEN v.currency = 'INR' THEN 2000.00 ELSE 20.00 END,
       v.currency,
       true,
       true
FROM (VALUES ('INR'), ('USD')) AS v(currency)
WHERE NOT EXISTS (
    SELECT 1
    FROM package_plans p
    WHERE lower(p.name) = lower('Customize Your Package')
      AND p.currency = v.currency
);

UPDATE package_plans
SET price = CASE WHEN currency = 'INR' THEN 2000.00 ELSE 20.00 END,
    updated_at = now()
WHERE lower(name) = lower('Customize Your Package')
  AND currency IN ('INR', 'USD')
  AND is_custom = true;
