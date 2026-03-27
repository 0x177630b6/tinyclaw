"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { usePolling } from "@/lib/hooks";
import { checkConnection } from "@/lib/api";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

const SKIP_LINK_CLASS =
  "sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium";

const FAIL_THRESHOLD = 3; // consecutive failures before redirecting

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hideSidebar = false;
  const failCount = useRef(0);

  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => setMounted(true), []);

  const { data: connected, loading } = usePolling(checkConnection, 5000);

  useEffect(() => {
    if (loading) return;
    if (connected === false) {
      failCount.current += 1;
      if (failCount.current >= FAIL_THRESHOLD && pathname !== "/settings") {
        router.replace("/settings");
      }
    } else {
      failCount.current = 0;
    }
  }, [connected, loading, pathname, router]);

  if (!mounted) {
    return (
      <div className="flex h-screen overflow-hidden">
        <a href="#main-content" className={SKIP_LINK_CLASS}>Skip to main content</a>
        {!hideSidebar && <Sidebar />}
        <main id="main-content" className="flex-1 overflow-y-auto">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <a href="#main-content" className={SKIP_LINK_CLASS}>Skip to main content</a>
      {isDesktop && !hideSidebar && <Sidebar />}

      {!isDesktop && !hideSidebar && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {!isDesktop && !hideSidebar && (
          <header className="flex items-center border-b px-4 py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="ml-2 text-sm font-bold">TinyAGI</span>
          </header>
        )}
        <main id="main-content" className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
