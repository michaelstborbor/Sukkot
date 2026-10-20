"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BedDouble, CalendarDays, Coffee, Users } from "lucide-react";
import { BREAKFAST_LABELS, CANCELLATION_POLICY_LABELS, TRIP_PURPOSE_LABELS, type StayDetails, type StayKind } from "@sukkot/shared";
import { api, ApiError } from "@/lib/api";
import { useApiForm } from "@/hooks/use-api-form";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export interface BookingRoom {
  id: string;
  name: string;
  description: string | null;
  bedType: string | null;
  roomsCount: number;
  maxAdults: number;
  maxChildren: number;
  nightly: string;
  monthly: string | null;
  breakfastIncluded: boolean;
  features: string[];
}

interface Quote {
  nights: number;
  rooms: number;
  isLate: boolean;
  noticeDays: number;
  lines: { label: string; amount: string }[];
  total: string;
}

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * The booking page form. Each kind of stay asks its own questions: hotels about airport pickup and
 * early check-in, guest houses about breakfast, motels about the vehicle, homes about the house rules.
 * The price comes from the server as the guest changes the dates; nothing is charged on submit.
 */
export function StayBookingForm({
  propertyId,
  kind,
  details,
  rooms,
  today,
  noticeDays,
  surchargePercent,
  signedIn,
  signInHref,
  guest,
}: {
  propertyId: string;
  kind: StayKind;
  details: StayDetails;
  rooms: BookingRoom[];
  today: string;
  noticeDays: number;
  surchargePercent: number;
  signedIn: boolean;
  signInHref: string;
  guest: { name: string; phone: string; email: string };
}) {
  const router = useRouter();
  const whole = kind === "SHORT_STAY_HOME";
  const firstFree = addDays(today, noticeDays);
  const [v, setV] = useState({
    roomTypeId: rooms[0]?.id ?? "",
    checkIn: firstFree,
    checkOut: addDays(firstFree, Math.max(details.minNights, 1)),
    rooms: "1",
    adults: "2",
    children: "0",
    guestName: guest.name,
    guestPhone: guest.phone,
    guestEmail: guest.email,
    guestCountry: "Sierra Leone",
    arrivalTime: "",
    specialRequests: "",
    acceptPolicy: false,
  });
  const [extras, setExtras] = useState<Record<string, string | boolean>>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteFields, setQuoteFields] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v, value: string | boolean) => setV((c) => ({ ...c, [k]: value }));
  const setExtra = (k: string, value: string | boolean) => setExtras((c) => ({ ...c, [k]: value }));
  const room = rooms.find((r) => r.id === v.roomTypeId) ?? rooms[0];
  const has = (f: string) => details.facilities.includes(f);

  const quoteBody = useMemo(
    () => ({ roomTypeId: v.roomTypeId, checkIn: v.checkIn, checkOut: v.checkOut, rooms: whole ? 1 : Number(v.rooms), adults: Number(v.adults), children: Number(v.children) }),
    [v.roomTypeId, v.checkIn, v.checkOut, v.rooms, v.adults, v.children, whole],
  );
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const q = await api<Quote>(`/properties/${propertyId}/stay/quote`, { body: quoteBody });
        if (!live) return;
        setQuote(q);
        setQuoteError(null);
        setQuoteFields({});
      } catch (err) {
        if (!live) return;
        setQuote(null);
        setQuoteError(err instanceof ApiError ? err.message : "Could not work out the price");
        setQuoteFields(err instanceof ApiError ? (err.fields ?? {}) : {});
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [propertyId, quoteBody]);

  const { submit, pending, errors, formError } = useApiForm<{ reference: string }>(`/properties/${propertyId}/stay/bookings`, {
    success: "Booking request sent",
    onSuccess: (b) => router.push(`/dashboard/stays/${b.reference}`),
  });
  const err = (k: string) => errors[k] ?? quoteFields[k];

  const extrasBody = Object.fromEntries(Object.entries(extras).filter(([, x]) => x !== "" && x !== false).map(([k, x]) => [k, k === "vehicles" ? Number(x) : x]));
  const policy = CANCELLATION_POLICY_LABELS[details.cancellationPolicy];

  return (
    <form
      className="space-y-8"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit({ ...quoteBody, guestName: v.guestName, guestPhone: v.guestPhone, guestEmail: v.guestEmail, guestCountry: v.guestCountry, arrivalTime: v.arrivalTime, specialRequests: v.specialRequests, extras: extrasBody, acceptPolicy: v.acceptPolicy });
      }}
    >
      <section aria-labelledby="when" className="space-y-4">
        <h2 id="when" className="flex items-center gap-2 text-lg font-bold text-navy-900"><CalendarDays className="h-5 w-5" aria-hidden /> When and who</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="checkIn" label={`Check-in (from ${details.checkInFrom})`} error={err("checkIn")}>
            <Input id="checkIn" type="date" min={today} value={v.checkIn} onChange={(e) => { set("checkIn", e.target.value); if (e.target.value >= v.checkOut) set("checkOut", addDays(e.target.value, Math.max(details.minNights, 1))); }} />
          </Field>
          <Field id="checkOut" label={`Check-out (by ${details.checkOutBy})`} error={err("checkOut")}>
            <Input id="checkOut" type="date" min={addDays(v.checkIn || today, 1)} value={v.checkOut} onChange={(e) => set("checkOut", e.target.value)} />
          </Field>
          {!whole && (
            <Field id="rooms" label="Rooms" error={err("rooms")}>
              <Select id="rooms" value={v.rooms} onChange={(e) => set("rooms", e.target.value)}>
                {Array.from({ length: Math.min(room?.roomsCount ?? 1, 10) }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
              </Select>
            </Field>
          )}
          <Field id="adults" label="Adults" error={err("adults")}>
            <Input id="adults" type="number" min={1} max={40} value={v.adults} onChange={(e) => set("adults", e.target.value)} />
          </Field>
          {details.childrenWelcome ? (
            <Field id="children" label="Children under 12" error={err("children")}>
              <Input id="children" type="number" min={0} max={20} value={v.children} onChange={(e) => set("children", e.target.value)} />
            </Field>
          ) : (
            <p className="self-end text-sm text-muted">This place does not take children.</p>
          )}
        </div>
        {v.checkIn && v.checkIn < firstFree && (
          <Notice tone="warning" title="Late booking">
            Bookings should be made at least {noticeDays} days before check-in. You can still ask for these dates, but late bookings cost {surchargePercent}% more and depend on the property confirming at short notice.
          </Notice>
        )}
      </section>

      <section aria-labelledby="room" className="space-y-3">
        <h2 id="room" className="flex items-center gap-2 text-lg font-bold text-navy-900"><BedDouble className="h-5 w-5" aria-hidden /> {whole ? "The place" : "Choose your room"}</h2>
        {err("roomTypeId") && <p className="text-sm text-danger">{err("roomTypeId")}</p>}
        <div className="grid gap-3">
          {rooms.map((r) => (
            <label key={r.id} className={cn("flex cursor-pointer gap-3 rounded-xl border p-4", v.roomTypeId === r.id ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20" : "border-line bg-surface hover:border-navy-600")}>
              <input type="radio" name="roomTypeId" value={r.id} checked={v.roomTypeId === r.id} onChange={() => set("roomTypeId", r.id)} className="mt-1 accent-emerald-700" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-navy-900">{whole ? "Whole place" : r.name}</span>
                  <span className="text-sm"><strong>{r.nightly}</strong> a night{r.monthly ? <> · <strong>{r.monthly}</strong> a month</> : null}</span>
                </span>
                {r.description && <span className="mt-1 block text-sm text-muted">{r.description}</span>}
                <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {r.bedType && <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" aria-hidden />{r.bedType}</span>}
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />Up to {r.maxAdults} adults{r.maxChildren ? ` and ${r.maxChildren} children` : ""}</span>
                  {r.breakfastIncluded && <span className="inline-flex items-center gap-1"><Coffee className="h-3.5 w-3.5" aria-hidden />Breakfast included</span>}
                  {!whole && <span>{r.roomsCount} room{r.roomsCount === 1 ? "" : "s"} of this kind</span>}
                </span>
                {r.features.length > 0 && <span className="mt-2 block text-xs text-ink/80">{r.features.join(" · ")}</span>}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section aria-labelledby="price" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="price" className="text-lg font-bold text-navy-900">Price</h2>
        {quote ? (
          <>
            <dl className="mt-3 space-y-1.5 text-sm">
              {quote.lines.map((l) => (
                <div key={l.label} className="flex justify-between gap-4"><dt className="text-muted">{l.label}</dt><dd className="font-medium">{l.amount}</dd></div>
              ))}
              <div className="flex justify-between gap-4 border-t border-line pt-2 text-base"><dt className="font-semibold">Total to pay Sukkot Salone</dt><dd className="font-bold text-navy-900">{quote.total}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-muted">Nothing is charged now. We check with the property first, then ask you to pay.</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">{quoteError ?? "Working out the price…"}</p>
        )}
      </section>

      <section aria-labelledby="guest" className="space-y-4">
        <h2 id="guest" className="text-lg font-bold text-navy-900">Guest details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="guestName" label="Full name, as on the guest's ID" error={err("guestName")}>
            <Input id="guestName" autoComplete="name" value={v.guestName} onChange={(e) => set("guestName", e.target.value)} />
          </Field>
          <Field id="guestPhone" label="Phone (WhatsApp if possible)" hint="From abroad, include the country code, e.g. +44 7700 900123" error={err("guestPhone")}>
            <Input id="guestPhone" type="tel" autoComplete="tel" value={v.guestPhone} onChange={(e) => set("guestPhone", e.target.value)} />
          </Field>
          <Field id="guestEmail" label="Email" error={err("guestEmail")}>
            <Input id="guestEmail" type="email" autoComplete="email" value={v.guestEmail} onChange={(e) => set("guestEmail", e.target.value)} />
          </Field>
          <Field id="guestCountry" label="Country you are travelling from" optional error={err("guestCountry")}>
            <Input id="guestCountry" autoComplete="country-name" value={v.guestCountry} onChange={(e) => set("guestCountry", e.target.value)} />
          </Field>
          <Field
            id="arrivalTime"
            label="Expected arrival time"
            optional
            hint={kind === "MOTEL" && has("checkIn24h") ? "Check in at any hour; tell us roughly when" : details.gateClosesAt ? `The gate is locked at ${details.gateClosesAt}` : `Check-in is from ${details.checkInFrom}`}
            error={err("arrivalTime")}
          >
            <Input id="arrivalTime" type="time" value={v.arrivalTime} onChange={(e) => set("arrivalTime", e.target.value)} />
          </Field>
        </div>
      </section>

      <section aria-labelledby="extras" className="space-y-3">
        <h2 id="extras" className="text-lg font-bold text-navy-900">{kind === "SHORT_STAY_HOME" ? "About your stay" : "Your preferences"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {kind === "HOTEL" && has("airportShuttle") && <Checkbox id="x-airport" label="I would like an airport pickup (the hotel quotes the price)" checked={!!extras.airportPickup} onChange={(e) => setExtra("airportPickup", e.target.checked)} />}
          {(kind === "HOTEL" || kind === "GUEST_HOUSE") && <Checkbox id="x-early" label={`Early check-in, before ${details.checkInFrom}, if possible`} checked={!!extras.earlyCheckIn} onChange={(e) => setExtra("earlyCheckIn", e.target.checked)} />}
          {kind === "HOTEL" && <Checkbox id="x-late" label={`Late check-out, after ${details.checkOutBy}, if possible`} checked={!!extras.lateCheckOut} onChange={(e) => setExtra("lateCheckOut", e.target.checked)} />}
          {(kind === "HOTEL" || kind === "GUEST_HOUSE" || kind === "MOTEL") && <Checkbox id="x-bed" label="An extra bed or cot in the room" checked={!!extras.extraBed} onChange={(e) => setExtra("extraBed", e.target.checked)} />}
          {details.breakfast === "EXTRA" && <Checkbox id="x-breakfast" label="Add breakfast (paid at the property)" checked={!!extras.breakfast} onChange={(e) => setExtra("breakfast", e.target.checked)} />}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {kind === "HOTEL" && extras.airportPickup && (
            <Field id="x-flight" label="Flight number and arrival time" optional error={err("extras.flightNumber")}>
              <Input id="x-flight" placeholder="e.g. AT 527, 21:40" value={String(extras.flightNumber ?? "")} onChange={(e) => setExtra("flightNumber", e.target.value)} />
            </Field>
          )}
          {kind === "MOTEL" && (
            <Field id="x-vehicle" label="Vehicle registration" optional hint="So the motel can keep a space at your door" error={err("extras.vehicleRegistration")}>
              <Input id="x-vehicle" placeholder="e.g. AJR 123" value={String(extras.vehicleRegistration ?? "")} onChange={(e) => setExtra("vehicleRegistration", e.target.value)} />
            </Field>
          )}
          {kind === "SHORT_STAY_HOME" && (
            <Field id="x-vehicles" label="Cars you will bring" optional error={err("extras.vehicles")}>
              <Input id="x-vehicles" type="number" min={0} max={10} value={String(extras.vehicles ?? "")} onChange={(e) => setExtra("vehicles", e.target.value)} />
            </Field>
          )}
          <Field id="x-purpose" label="Reason for the trip" optional>
            <Select id="x-purpose" value={String(extras.tripPurpose ?? "")} onChange={(e) => setExtra("tripPurpose", e.target.value)}>
              <option value="">Prefer not to say</option>
              {Object.entries(TRIP_PURPOSE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </Select>
          </Field>
        </div>
        <Field id="specialRequests" label="Anything else the property should know" optional error={err("specialRequests")}>
          <Textarea id="specialRequests" maxLength={1000} placeholder="Dietary needs, accessibility, a quiet room, celebrating something…" value={v.specialRequests} onChange={(e) => set("specialRequests", e.target.value)} />
        </Field>
        {kind === "SHORT_STAY_HOME" && (
          <div className="rounded-xl border border-line bg-surface p-4 text-sm">
            <p className="font-semibold">House rules</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
              <li>{details.partiesAllowed ? "Small gatherings allowed" : "No parties or events"}</li>
              <li>{details.smokingAllowed ? "Smoking allowed" : "No smoking inside"}</li>
              <li>{details.petsAllowed ? "Pets allowed" : "No pets"}</li>
              {details.houseRules && <li className="whitespace-pre-line">{details.houseRules}</li>}
            </ul>
            <Checkbox id="x-rules" className="mt-3" label="I agree to the house rules" checked={!!extras.agreeHouseRules} onChange={(e) => setExtra("agreeHouseRules", e.target.checked)} />
            {err("extras.agreeHouseRules") && <p className="mt-1 text-xs text-danger">{err("extras.agreeHouseRules")}</p>}
          </div>
        )}
      </section>

      <section aria-labelledby="how" className="space-y-3 rounded-2xl bg-navy-50 p-5 text-sm">
        <h2 id="how" className="text-lg font-bold text-navy-900">How booking works</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>We check with the property that your room is free, usually within a few hours.</li>
          <li>When they confirm, we ask you to pay Sukkot Salone by mobile money or bank transfer. From abroad, use an international bank transfer or a money transfer app that pays into Orange Money or Afrimoney. Unpaid bookings are released at the deadline we give you.</li>
          <li>Once our team confirms your payment you get a receipt with the address, your room and your dates. Show it at check-in{details.idRequired ? " with your passport or national ID" : ""}.</li>
        </ol>
        <p><strong>Cancellation: {policy.name}.</strong> {policy.summary} The late booking charge is not refunded. If the property lets you down, you get everything back.</p>
        <p>{BREAKFAST_LABELS[details.breakfast]}.{details.starRating ? ` ${details.starRating}-star hotel.` : ""}</p>
        <Checkbox id="acceptPolicy" label="I agree to the cancellation policy and that payment goes to Sukkot Salone, which pays the property" checked={v.acceptPolicy} onChange={(e) => set("acceptPolicy", e.target.checked)} />
        {err("acceptPolicy") && <p className="text-xs text-danger">{err("acceptPolicy")}</p>}
      </section>

      {formError && <Notice tone="danger">{formError}</Notice>}
      {signedIn ? (
        <Button type="submit" size="lg" className="w-full sm:w-auto" loading={pending} disabled={!quote}>
          Ask for this booking{quote ? ` (${quote.total})` : ""}
        </Button>
      ) : (
        <div className="space-y-2">
          <Link href={signInHref} className={buttonClasses("primary", "lg")}>Sign in to book</Link>
          <p className="text-sm text-muted">You need a free account so we can keep you updated and send your receipt.</p>
        </div>
      )}
    </form>
  );
}
