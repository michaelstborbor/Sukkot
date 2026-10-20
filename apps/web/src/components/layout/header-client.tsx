"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, Building2, ChevronDown, LayoutDashboard, LogOut, Menu, MessageSquare, Plus, Shield, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { buttonClasses } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", match: "/" },
  { href: "/properties?purpose=SALE", label: "Buy", match: "SALE" },
  { href: "/properties?purpose=RENT", label: "Rent", match: "RENT" },
  { href: "/properties?category=LAND", label: "Land", match: "LAND" },
  { href: "/properties?category=COMMERCIAL", label: "Commercial", match: "COMMERCIAL" },
  { href: "/stays", label: "Short stays", match: "/stays" },
  { href: "/agents", label: "Agents", match: "/agents" },
];

interface HeaderUser {
  name: string;
  canList: boolean;
  isStaff: boolean;
  unreadMessages: number;
  unreadNotifications: number;
}

function CountDot({ n }: { n: number }) {
  if (!n) return null;
  return <span className="absolute -top-1 -right-1 min-w-[18px] rounded-full bg-clay-600 px-1 text-center text-[11px] leading-[18px] font-bold text-white">{n > 99 ? "99+" : n}</span>;
}

/** Where "My listings" goes: the lister's own listings, or sign-in first. Hidden for signed-in accounts that cannot list. */
function myListingsHref(user: HeaderUser | null) {
  if (!user) return `/auth/sign-in?next=${encodeURIComponent("/dashboard/properties")}`;
  return user.canList ? "/dashboard/properties" : null;
}

export function HeaderClient({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  const myListings = myListingsHref(user);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [menuTop, setMenuTop] = useState(64);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    // The mobile menu sits just under the header, wherever the header is on screen now.
    if (open && headerRef.current) setMenuTop(headerRef.current.getBoundingClientRect().bottom);
  }, [open]);

  async function signOut() {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <header ref={headerRef} className={cn("sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur transition-shadow", scrolled && "shadow-[0_6px_20px_-12px_rgb(43_27_18/0.25)]")}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <div className="shrink-0"><Logo /></div>
          <nav aria-label="Main" className="hidden items-center gap-4 lg:flex xl:gap-6">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="nav-underline whitespace-nowrap py-1 text-[15px] font-bold text-ink/90 hover:text-ink xl:text-base">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href={user?.canList ? "/dashboard/properties/new" : "/list-your-property"} className={buttonClasses("outline", "sm", "hidden sm:inline-flex")}>
              <Plus className="h-4 w-4" aria-hidden /> List a property
            </Link>
            {/* Between lg and xl the main links leave no room for it; it is in the account menu there too. */}
            {myListings && (
              <Link href={myListings} aria-current={pathname === "/dashboard/properties" ? "page" : undefined} className={buttonClasses("outline", "sm", "hidden sm:inline-flex lg:hidden xl:inline-flex")}>
                <Building2 className="h-4 w-4" aria-hidden /> My listings
              </Link>
            )}
            {user ? (
              <>
                <Link href="/dashboard/messages" className="relative hidden rounded-full p-2 text-navy-800 hover:bg-navy-50 sm:inline-flex" aria-label={`Messages${user.unreadMessages ? `, ${user.unreadMessages} unread` : ""}`}>
                  <MessageSquare className="h-5 w-5" />
                  <CountDot n={user.unreadMessages} />
                </Link>
                <Link href="/dashboard/notifications" className="relative hidden rounded-full p-2 text-navy-800 hover:bg-navy-50 sm:inline-flex" aria-label={`Notifications${user.unreadNotifications ? `, ${user.unreadNotifications} unread` : ""}`}>
                  <Bell className="h-5 w-5" />
                  <CountDot n={user.unreadNotifications} />
                </Link>
                <div className="relative hidden lg:block" ref={menuRef}>
                  <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" aria-label={`Account menu for ${user.name}`} className="flex items-center gap-2 rounded-full border border-line py-1 pr-2.5 pl-1 transition hover:border-navy-600">
                    <Avatar name={user.name} size={30} />
                    <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", menu && "rotate-180")} />
                  </button>
                  {menu && (
                    <div role="menu" className="absolute right-0 mt-2 w-60 animate-[fade-up_0.18s_ease-out] rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]">
                      <p className="truncate px-3 py-2 text-sm font-semibold text-navy-900">{user.name}</p>
                      <MenuLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>Dashboard</MenuLink>
                      {user.canList && <MenuLink href="/dashboard/properties" icon={<Building2 className="h-4 w-4" />}>My listings</MenuLink>}
                      <MenuLink href="/dashboard/messages" icon={<MessageSquare className="h-4 w-4" />}>Messages</MenuLink>
                      {user.isStaff && <MenuLink href="/admin" icon={<Shield className="h-4 w-4" />}>Administration</MenuLink>}
                      <button type="button" role="menuitem" onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-navy-50">
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="hidden items-center gap-1 lg:flex">
                <Link href="/auth/sign-in" className={buttonClasses("ghost", "sm")}>Sign in</Link>
                <Link href="/auth/sign-up" className={buttonClasses("primary", "sm")}>Sign up</Link>
              </div>
            )}
            <button type="button" className="rounded-lg p-2 text-navy-900 lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

      </header>
      {/* Outside the header on purpose: its backdrop blur would make it the containing block for this
          fixed panel and squash the panel to zero height. */}
      {open && (
        <div style={{ top: menuTop }} className="fixed inset-x-0 bottom-0 z-40 animate-[fade-in_0.18s_ease-out] overflow-y-auto bg-surface lg:hidden">
          <nav aria-label="Mobile" className="container-page flex flex-col gap-1 py-4">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-3 text-lg font-bold text-navy-900 hover:bg-navy-50">
                {n.label}
              </Link>
            ))}
            <hr className="my-3 border-line" />
            <Link href={user?.canList ? "/dashboard/properties/new" : "/list-your-property"} className={buttonClasses("accent", "lg", "w-full")}>
              <Plus className="h-5 w-5" /> List a property
            </Link>
            {myListings && (
              <Link href={myListings} className={buttonClasses("outline", "lg", "mt-2 w-full")}>
                <Building2 className="h-5 w-5" /> My listings
              </Link>
            )}
            {user ? (
              <>
                <Link href="/dashboard" className="rounded-lg px-3 py-3 font-medium hover:bg-navy-50">Dashboard</Link>
                <Link href="/dashboard/messages" className="rounded-lg px-3 py-3 font-medium hover:bg-navy-50">Messages {user.unreadMessages ? `(${user.unreadMessages})` : ""}</Link>
                <Link href="/dashboard/notifications" className="rounded-lg px-3 py-3 font-medium hover:bg-navy-50">Notifications {user.unreadNotifications ? `(${user.unreadNotifications})` : ""}</Link>
                {user.isStaff && <Link href="/admin" className="rounded-lg px-3 py-3 font-medium hover:bg-navy-50">Administration</Link>}
                <button type="button" onClick={signOut} className="rounded-lg px-3 py-3 text-left font-medium hover:bg-navy-50">Sign out</button>
              </>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href="/auth/sign-in" className={buttonClasses("outline", "lg")}>Sign in</Link>
                <Link href="/auth/sign-up" className={buttonClasses("primary", "lg")}>Sign up</Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link role="menuitem" href={href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-navy-50">
      {icon}
      {children}
    </Link>
  );
}
