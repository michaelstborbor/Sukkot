-- The property type list requested by the business. Existing listings move to the closest new
-- type (their category never changes), and the old types are switched off, not deleted.
INSERT INTO "property_types" ("id", "name", "slug", "category", "description", "sortOrder", "isActive") VALUES
  ('pt-empty-land',         'Empty land',         'empty-land',         'LAND',       'Plots and land with no building on it',            0,  true),
  ('pt-land-with-property', 'Land with property', 'land-with-property', 'LAND',       'Land sold or leased with a building on it',        1,  true),
  ('pt-house',              'House',              'house',              'HOUSE',      'Houses, bungalows and duplexes',                    2,  true),
  ('pt-apartment',          'Apartment',          'apartment',          'APARTMENT',  'Flats and self-contained rooms',                    3,  true),
  ('pt-shop',               'Shop',               'shop',               'COMMERCIAL', 'Retail units and stores',                           4,  true),
  ('pt-office',             'Office',             'office',             'COMMERCIAL', 'Offices and co-working space',                      5,  true),
  ('pt-short-stay',         'Short stay',         'short-stay',         'SHORT_STAY', 'Furnished places to stay by the night or week',     6,  true),
  ('pt-commercial',         'Commercial',         'commercial',         'COMMERCIAL', 'Warehouses, workshops and other business premises', 7,  true),
  ('pt-hotel',              'Hotel',              'hotel',              'COMMERCIAL', 'Hotels for sale, lease or rent',                    8,  true),
  ('pt-guesthouse',         'Guesthouse',         'guesthouse',         'COMMERCIAL', 'Guesthouses for sale, lease or rent',               9,  true),
  ('pt-motel',              'Motel',              'motel',              'COMMERCIAL', 'Motels for sale, lease or rent',                    10, true),
  ('pt-other',              'Other',              'other',              'OTHER',      'Anything else; the lister says what it is',         11, true)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true;

UPDATE "properties" AS p
SET "propertyTypeId" = n."id", "category" = n."category"
FROM "property_types" AS o,
     "property_types" AS n,
     (VALUES
       ('bungalow', 'house'),
       ('duplex', 'house'),
       ('new-development', 'house'),
       ('studio', 'apartment'),
       ('residential-plot', 'empty-land'),
       ('commercial-plot', 'empty-land'),
       ('agricultural-land', 'empty-land'),
       ('office-space', 'office'),
       ('warehouse', 'commercial'),
       ('hotel-or-guesthouse', 'hotel'),
       ('short-stay-apartment', 'short-stay'),
       ('guesthouse-room', 'short-stay')
     ) AS m("oldSlug", "newSlug")
WHERE p."propertyTypeId" = o."id" AND o."slug" = m."oldSlug" AND n."slug" = m."newSlug";

UPDATE "property_types" SET "isActive" = false
WHERE "slug" IN ('bungalow', 'duplex', 'new-development', 'studio', 'residential-plot', 'commercial-plot', 'agricultural-land', 'office-space', 'warehouse', 'hotel-or-guesthouse', 'short-stay-apartment', 'guesthouse-room');
