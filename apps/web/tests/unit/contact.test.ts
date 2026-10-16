import { describe, expect, it } from "vitest";
import { GENERAL_ENQUIRY, listingEnquiry, SUPPORT_CONTACT, telLink, whatsappLink } from "@sukkot/shared";

describe("Sukkot Salone contact links", () => {
  it("opens a WhatsApp chat with the team's number, with the message typed in", () => {
    expect(SUPPORT_CONTACT.phone).toBe("+232 78 604374");
    expect(whatsappLink(SUPPORT_CONTACT.whatsapp)).toBe("https://wa.me/23278604374");
    expect(whatsappLink(SUPPORT_CONTACT.whatsapp, "Listing SKT-1: 2 bed & bath")).toBe("https://wa.me/23278604374?text=Listing%20SKT-1%3A%202%20bed%20%26%20bath");
  });

  it("calls the same number", () => {
    expect(telLink(SUPPORT_CONTACT.phone)).toBe("tel:+23278604374");
  });

  it("greets the team in a chat that is not about a listing", () => {
    expect(GENERAL_ENQUIRY).toBe("Hello Sukkot Salone, I have a question.");
  });

  it("names the property's type, location and price in a chat started from a listing", () => {
    const listing = { title: "Furnished 2-bedroom apartment in Aberdeen", typeName: "Apartment", locationLabel: "Aberdeen, Freetown", district: "Western Area Urban", price: { formatted: "Le 42,000 / month" } };
    expect(listingEnquiry(listing, "https://sukkot.example/properties/furnished-2-bedroom")).toBe(
      [
        "Hello Sukkot Salone, I saw this apartment and I'd like to know more about it.",
        "",
        "Furnished 2-bedroom apartment in Aberdeen",
        "Type: Apartment",
        "Location: Aberdeen, Freetown · Western Area Urban",
        "Price: Le 42,000 / month",
        "https://sukkot.example/properties/furnished-2-bedroom",
        "",
        "Is it still available?",
      ].join("\n"),
    );
    expect(listingEnquiry({ ...listing, district: "Aberdeen" })).not.toContain("·");
  });
});
