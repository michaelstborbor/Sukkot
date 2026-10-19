import { describe, expect, it } from "vitest";
import { searchFromText } from "@/components/layout/help-chat";

describe("help chat search", () => {
  it("turns a sentence into a listings search", () => {
    const url = new URL(searchFromText("2 bedroom flat to rent in Lumley")!, "http://x");
    expect(url.pathname).toBe("/properties");
    expect(Object.fromEntries(url.searchParams)).toEqual({ purpose: "RENT", category: "APARTMENT", beds: "2", q: "Lumley" });
    expect(Object.fromEntries(new URL(searchFromText("land for sale near Waterloo under 200,000")!, "http://x").searchParams)).toEqual({ purpose: "SALE", category: "LAND", q: "Waterloo" });
  });

  it("leaves sentences that are not searches alone", () => {
    expect(searchFromText("what time do you open?")).toBeNull();
  });
});
