import { brand } from "@/config/brand";
import { HouseMark } from "@/components/ui/house-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page flex justify-center py-10 sm:py-14">
      <div className="grid w-full max-w-md overflow-hidden lg:max-w-5xl lg:grid-cols-[1fr_28rem] lg:rounded-[var(--radius-card)] lg:border lg:border-line lg:bg-surface lg:shadow-[var(--shadow-lift)]">
        {/* The stage for the logo: deep navy, with the house built in the middle. Large screens only. */}
        <div className="relative hidden flex-col items-center justify-center overflow-hidden bg-[#0B1F3A] px-10 py-16 text-center lg:flex">
          <HouseMark className="relative h-40 w-40" />
          <p className="after-house relative mt-8 font-[family-name:var(--font-fraunces)] text-3xl font-semibold tracking-tight text-white">
            {brand.shortName}
            <span className="text-[#C8962E]"> Salone</span>
          </p>
          <p className="after-house relative mt-3 max-w-xs text-base text-white/75 [animation-delay:1.4s]">{brand.tagline}</p>
        </div>
        <div className="lg:p-10">
          <div className="mb-6 flex justify-center lg:hidden">
            <HouseMark className="h-16 w-16" />
          </div>
          <div className="card after-house p-6 sm:p-8 lg:border-0 lg:p-0 lg:shadow-none [animation-delay:0.35s] lg:[animation:none]">{children}</div>
        </div>
      </div>
    </div>
  );
}
