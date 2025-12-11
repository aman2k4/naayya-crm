"use client";

import { useEffect } from "react";
import {
  LayoutDashboard,
  Radio,
  FileText,
  Users2,
  LogOut,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUser } from '@/app/contexts/UserContext';

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isGlobalAdmin, isLoading, logout } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not logged in - will redirect
  if (!user) {
    return null;
  }

  // Not a global admin
  if (!isGlobalAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access the CRM.</p>
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    { href: "/crm", label: "Dashboard", icon: LayoutDashboard },
    { href: "/crm/audience/segments", label: "Segments", icon: Users2 },
    { href: "/crm/broadcasts", label: "Broadcasts", icon: Radio },
    { href: "/crm/templates", label: "Templates", icon: FileText },
  ];

  const isActiveTab = (href: string) => {
    if (href === "/crm") {
      return pathname === "/crm";
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Bar with Browser-like Tabs */}
      <div className="flex-shrink-0 border-b bg-muted/30">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Left: Brand + Tabs */}
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-2 px-3 py-1 mr-2">
              <h1 className="text-sm font-semibold text-primary">Naayya CRM</h1>
            </div>

            {/* Browser-like Tabs */}
            <div className="flex items-center gap-0.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = isActiveTab(tab.href);
                return (
                  <Link key={tab.href} href={tab.href}>
                    <div
                      className={`
                        flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition-all
                        ${active
                          ? 'bg-background text-foreground border-t border-x border-border shadow-sm'
                          : 'bg-transparent text-muted-foreground hover:bg-muted/50'
                        }
                      `}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-primary' : ''}`} />
                      <span className={active ? 'font-medium' : ''}>{tab.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: User Profile + Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {user?.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground hidden md:block">
                {user?.email}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
