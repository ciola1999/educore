"use client";

import { SessionProvider } from "next-auth/react";
import { isTauri } from "@/core/env";

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const desktopRuntime = isTauri();

  return (
    <SessionProvider
      refetchOnWindowFocus={!desktopRuntime}
      refetchInterval={desktopRuntime ? 0 : 5 * 60}
    >
      {children}
    </SessionProvider>
  );
}
