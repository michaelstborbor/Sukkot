import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/dashboard/stays?tab=1#top")).toBe("/dashboard/stays?tab=1#top");
    expect(safeNext("/properties")).toBe("/properties");
  });

  it("refuses anything a browser would treat as another site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/%09/evil.com".replace("%09", "\t"), "https://evil.com", "evil.com", "", null, undefined]) {
      expect(safeNext(bad)).toBe("/dashboard");
    }
  });
});
