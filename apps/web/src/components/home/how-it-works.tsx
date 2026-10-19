"use client";

import { useState } from "react";
import { CalendarCheck, FileSignature, Handshake, ImagePlus, KeyRound, MessageSquare, Search, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const FLOWS = {
  rent: [
    { icon: Search, title: "Search and shortlist", body: "Filter by town, budget, bedrooms, water and power. Save favourites and compare." },
    { icon: CalendarCheck, title: "Book an inspection", body: "Pick a time; the landlord confirms or suggests another. View before paying anything." },
    { icon: KeyRound, title: "Apply and agree terms", body: "Send an application, agree rent and advance, then sign your agreement properly." },
  ],
  buy: [
    { icon: ShieldCheck, title: "Find checked listings", body: "Look for Documents Reviewed and verified owners and agents." },
    { icon: Handshake, title: "Make an offer", body: "Offer, counter and agree in principle with a full timeline of every step." },
    { icon: FileSignature, title: "Do your due diligence", body: "Work through the land checklist with your lawyer before any transfer." },
  ],
  list: [
    { icon: ImagePlus, title: "Add your property", body: "Photos, price, rental terms and location in a few minutes, even on mobile." },
    { icon: Users, title: "Get verified", body: "Upload ID and ownership documents so tenants and buyers can trust you." },
    { icon: MessageSquare, title: "Manage leads", body: "Reply to enquiries, schedule inspections and track applications in one place." },
  ],
};

export function HowItWorks() {
  const [tab, setTab] = useState<keyof typeof FLOWS>("rent");
  return (
    <div>
      <div role="tablist" aria-label="How it works" className="mx-auto mb-8 flex w-fit gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
        {(["rent", "buy", "list"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={cn("rounded-full px-5 py-2 text-sm font-semibold capitalize transition", tab === t ? "bg-navy-900 text-white" : "text-muted hover:text-navy-900")}>
            {t === "list" ? "List" : t === "rent" ? "Rent" : "Buy"}
          </button>
        ))}
      </div>
      <ol key={tab} className="grid gap-5 md:grid-cols-3">
        {FLOWS[tab].map((s, i) => (
          <li key={s.title} className="card animate-[fade-up_0.35s_ease-out_both] p-6" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><s.icon className="h-5 w-5" aria-hidden /></span>
              <span className="text-sm font-bold text-gold-600">Step {i + 1}</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-navy-900">{s.title}</h3>
            <p className="mt-1.5 text-[15px] text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
