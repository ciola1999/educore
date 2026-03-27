"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { isTauri } from "@/core/env";
import { ensureAppWarmup } from "@/lib/runtime/app-bootstrap";

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const desktopRuntime = isTauri();

  useEffect(() => {
    void ensureAppWarmup();
  }, []);

  return (
    <SessionProvider
      refetchOnWindowFocus={!desktopRuntime}
      refetchInterval={desktopRuntime ? 0 : 5 * 60}
    >
      {children}
    </SessionProvider>
  );
}
