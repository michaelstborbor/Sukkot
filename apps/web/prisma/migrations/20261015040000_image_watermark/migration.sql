-- Photos uploaded from now on carry the Sukkot Salone mark; older ones are marked by the bootstrap step.
ALTER TABLE "property_images" ADD COLUMN "watermarked" BOOLEAN NOT NULL DEFAULT false;
