-- Room and Studio join the property type list, straight after Apartment. Studio existed before as a
-- switched-off type, so it is switched back on rather than added twice.
UPDATE "property_types" SET "sortOrder" = "sortOrder" + 2
WHERE "isActive" = true AND "sortOrder" >= 4 AND "slug" NOT IN ('room', 'studio');

INSERT INTO "property_types" ("id", "name", "slug", "category", "description", "sortOrder", "isActive") VALUES
  ('pt-room',   'Room',   'room',   'APARTMENT', 'A single room in a shared house or compound',                4, true),
  ('pt-studio', 'Studio', 'studio', 'APARTMENT', 'A self-contained room with its own kitchen area and shower', 5, true)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true;

UPDATE "property_types" SET "description" = 'Flats with one or more bedrooms' WHERE "slug" = 'apartment';
