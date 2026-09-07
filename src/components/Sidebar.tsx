"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ROLE_LABEL, type Role } from "@/lib/domain";
import { canRead, type ModuleKey } from "@/lib/rbac";

type NavItem = { href: string; label: string; module: ModuleKey };

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Praca",
    items: [
      { href: "/dashboard", label: "Pulpit", module: "dashboard" },
      { href: "/projects", label: "Projekty", module: "projects" },
      { href: "/tasks", label: "Zadania", module: "tasks" },
      { href: "/gantt", label: "Harmonogram", module: "gantt" },
      { href: "/notifications", label: "Powiadomienia", module: "dashboard" },
    ],
  },
  {
    group: "Klienci i finanse",
    items: [
      { href: "/crm", label: "CRM", module: "crm" },
      { href: "/finances", label: "Finanse", module: "finances" },
      { href: "/experts", label: "Eksperci", module: "experts" },
    ],
  },
  {
    group: "Ustawienia",
    items: [
      { href: "/improvements", label: "Panel Usprawnień", module: "improvements" },
      { href: "/admin", label: "Administracja", module: "admin" },
    ],
  },
];

export function Sidebar({
  user,
  unreadCount,
}: {
  user: { fullName: string; role: Role; email: string };
  unreadCount: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col overflow-y-auto border-r border-border px-4 py-6 md:flex">
      <Link href="/dashboard" className="block px-3">
        <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-accent">ADVISE YOU</p>
        <p className="mt-1 font-display text-[19px] font-black tracking-tight text-ink">
          ELEVATE OS
        </p>
      </Link>

      <div className="mt-7 flex-1">
        {NAV.map((group) => {
          const items = group.items.filter((item) => canRead(user.role, item.module));
          if (items.length === 0) return null;
          return (
            <div key={group.group} className="mb-5">
              <p className="mx-3 mb-2 font-mono text-[10px] uppercase tracking-wider text-muted">
                {group.group}
              </p>
              {items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mb-0.5 flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[13.5px] transition-colors ${
                      active
                        ? "bg-accent-soft font-semibold text-accent"
                        : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.href === "/notifications" && unreadCount > 0 && (
                      <span className="rounded-full bg-crit px-1.5 py-px font-mono text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border pt-4">
        <p className="px-3 text-[13px] font-semibold text-ink">{user.fullName}</p>
        <p className="px-3 font-mono text-[10.5px] text-muted">{ROLE_LABEL[user.role]}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-2 w-full rounded-lg px-3 py-1.5 text-left text-[13px] text-muted hover:bg-surface-2 hover:text-ink"
        >
          Wyloguj
        </button>
      </div>
    </nav>
  );
}
