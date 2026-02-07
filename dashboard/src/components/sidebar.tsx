"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  ArrowRightLeft,
  BarChart3,
  Activity,
  Brain,
} from "lucide-react";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Handoffs", href: "/handoffs", icon: ArrowRightLeft },
  { name: "Usage", href: "/usage", icon: BarChart3 },
  { name: "Activity", href: "/activity", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Brain className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">Cortex</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <div className="rounded-md bg-muted px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            Agent Team
          </p>
          <div className="mt-1 flex gap-1">
            {["Luna", "Mia", "Anna", "Jasper", "Helios"].map((agent) => (
              <span
                key={agent}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
                title={agent}
              >
                {agent[0]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
