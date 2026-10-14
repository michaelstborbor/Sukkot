import { LogoMark } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page flex justify-center py-12 sm:py-16">
      <div className="w-full max-w-md animate-[fade-up_0.4s_ease-out]">
        <div className="mb-6 flex justify-center"><LogoMark className="h-12 w-12" /></div>
        <div className="card p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
