"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  aliases?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/catalog", label: "Catalog", aliases: ["/services", "/application-services", "/platform-services"] },
  { href: "/create", label: "Create" },
  { href: "/history", label: "History" },
  { href: "/technical", label: "Technical" },
  { href: "/argocd", label: "ArgoCD" }
];

function matchesRoute(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isActive(pathname: string, item: NavItem): boolean {
  if (matchesRoute(pathname, item.href)) {
    return true;
  }
  return (item.aliases ?? []).some((alias) => matchesRoute(pathname, alias));
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="topbar-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`topnav-link${isActive(pathname, item) ? " active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
