/**
 * Notices and checklists shown in the product. The wording is deliberately cautious and
 * is flagged for review by qualified Sierra Leonean counsel before launch (docs/LEGAL_REVIEW.md).
 */

export const DUE_DILIGENCE_TEMPLATE: { key: string; title: string; guidance: string }[] = [
  {
    key: "seller_identity",
    title: "Identity of the seller",
    guidance: "Meet the seller in person and check a government-issued ID that matches the documents.",
  },
  {
    key: "seller_authority",
    title: "Seller's authority to sell",
    guidance:
      "Confirm the seller is the registered owner, or holds a valid power of attorney or family consent where land is family-owned.",
  },
  {
    key: "title_documents",
    title: "Title or ownership documents",
    guidance: "Obtain copies of the conveyance, lease, state grant or other title document and have a lawyer review them.",
  },
  {
    key: "survey_plan",
    title: "Survey and parcel information",
    guidance: "Obtain a survey plan signed by a licensed surveyor and check it against the records at the Ministry of Lands.",
  },
  {
    key: "boundaries",
    title: "Land boundaries and location",
    guidance: "Walk the boundaries with the seller and a surveyor; confirm beacons match the survey plan.",
  },
  {
    key: "encumbrances",
    title: "Encumbrances or competing claims",
    guidance: "Check for mortgages, leases, court cases or competing claims, including with neighbours and local authorities.",
  },
  {
    key: "land_use",
    title: "Planning or land-use restrictions",
    guidance: "Check zoning, building permits and any restrictions on how the land may be used.",
  },
  {
    key: "official_search",
    title: "Official searches and verification",
    guidance: "Have a lawyer conduct searches at the Office of the Administrator and Registrar General and the Ministry of Lands.",
  },
  {
    key: "agreement_documented",
    title: "Agreed transaction documented",
    guidance: "Put the agreed price, payment schedule and conditions in a written agreement prepared or reviewed by a lawyer.",
  },
  {
    key: "registration",
    title: "Registration and transfer",
    guidance: "Complete stamping and registration of the conveyance in line with applicable procedures.",
  },
];

export const NOTICES = {
  offerNotLegal:
    "An offer accepted on Sukkot Salone is an agreement in principle only. It is not a binding contract and does not transfer ownership. Ownership transfers only through the applicable legal and land registration process in Sierra Leone. Get independent legal advice before paying any money.",
  verificationLimits:
    "Verification badges show which checks our team has completed. They do not certify legal title and do not replace an official search or a lawyer's advice.",
  inspectionSafety:
    "Meet in daylight, bring someone with you, and confirm the representative's identity before entering a property. Never pay the owner or agent any money before you have inspected the property and checked the ownership documents.",
  paymentHonesty:
    "A payment is shown as paid only after the payment provider confirms it. Payments recorded manually are marked as recorded, not verified.",
  noEscrow:
    "Sukkot Salone does not hold client funds or provide escrow. Rent, deposits and sale proceeds are paid directly between the parties. The one exception is hotel and short-stay bookings, which guests pay to Sukkot Salone and we pay the property.",
  stayPayments:
    "Hotel, guest house, motel and short-stay bookings are paid to Sukkot Salone, after the property has confirmed the room. We pay the property its share after deducting our agreed commission, and refund guests under the booking's cancellation policy.",
  rentalTermsReview:
    "Rental terms are set by the landlord. Check that advance rent, deposits and conditions comply with applicable tenancy law before agreeing.",
  demoContent: "Demonstration listing with fictional details and illustrative artwork.",
} as const;
