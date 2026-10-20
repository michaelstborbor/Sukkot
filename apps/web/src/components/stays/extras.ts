import { TRIP_PURPOSE_LABELS, type StayExtras } from "@sukkot/shared";

/** Plain words for the answers a guest gave to the questions for their kind of stay. */
export function extrasSummary(e: StayExtras) {
  return [
    e.airportPickup && `Airport pickup${e.flightNumber ? ` (${e.flightNumber})` : ""}`,
    e.earlyCheckIn && "Early check-in if possible",
    e.lateCheckOut && "Late check-out if possible",
    e.extraBed && "Extra bed or cot",
    e.breakfast && "Breakfast (paid at the property)",
    e.vehicleRegistration && `Vehicle ${e.vehicleRegistration}`,
    e.vehicles !== undefined && `${e.vehicles} car${e.vehicles === 1 ? "" : "s"}`,
    e.tripPurpose && TRIP_PURPOSE_LABELS[e.tripPurpose],
    e.agreeHouseRules && "Agreed to the house rules",
  ].filter(Boolean) as string[];
}
