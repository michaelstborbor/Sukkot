import { describe, expect, it } from "vitest";
import { SUPPORT_CONTACT, telLink, whatsappLink } from "@sukkot/shared";

describe("Sukkot Salone contact links", () => {
  it("opens a WhatsApp chat with the team's number, with the message typed in", () => {
    expect(SUPPORT_CONTACT.phone).toBe("+232 78 604374");
    expect(whatsappLink(SUPPORT_CONTACT.whatsapp)).toBe("https://wa.me/23278604374");
    expect(whatsappLink(SUPPORT_CONTACT.whatsapp, "Listing SKT-1: 2 bed & bath")).toBe("https://wa.me/23278604374?text=Listing%20SKT-1%3A%202%20bed%20%26%20bath");
  });

  it("calls the same number", () => {
    expect(telLink(SUPPORT_CONTACT.phone)).toBe("tel:+23278604374");
  });
});
