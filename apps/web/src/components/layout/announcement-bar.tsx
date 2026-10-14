import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getSetting } from "@/server/services/settings";
import { env } from "@/server/env";

export async function AnnouncementBar() {
  const a = await getSetting("site.announcement");
  if (!a?.enabled && !env.demoMode) return null;
  return (
    <div className="bg-navy-950 text-[13px] text-white/90">
      <div className="container-page flex min-h-9 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 py-1.5 text-center">
        {a?.enabled && (
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-gold-500" aria-hidden />
            {a.link ? (
              <Link href={a.link} className="underline-offset-2 hover:underline">
                {a.text}
              </Link>
            ) : (
              a.text
            )}
          </span>
        )}
        {env.demoMode && <span className="rounded-full bg-gold-500/20 px-2 py-0.5 text-[11px] font-semibold text-gold-100">Demo mode · sample listings are fictional</span>}
      </div>
    </div>
  );
}
