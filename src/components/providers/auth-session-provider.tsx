"use client";

import type { Session } from "next-auth";
import { SessionProvider, useSession } from "next-auth/react";
import { createContext, useContext, useEffect, useState } from "react";
import { isTauri } from "@/core/env";
import { ensureAppWarmup } from "@/lib/runtime/app-bootstrap";
import { useStore } from "@/lib/store/use-store";

type AuthSessionContextValue = {
  desktopRuntime: boolean;
  status: "authenticated" | "unauthenticated" | "loading";
  session: Session | null;
};

const AuthSessionRuntimeContext = createContext<AuthSessionContextValue>({
  desktopRuntime: false,
  status: "loading",
  session: null,
});

function DesktopSessionProvider({ children }: { children: React.ReactNode }) {
  const user = useStore((state) => state.user);

  return (
    <AuthSessionRuntimeContext.Provider
      value={{
        desktopRuntime: true,
        status: user ? "authenticated" : "unauthenticated",
        session: null,
      }}
    >
      {children}
    </AuthSessionRuntimeContext.Provider>
  );
}

function WebSessionProvider({ children }: { children: React.ReactNode }) {
  function SessionRuntimeBridge({ children }: { children: React.ReactNode }) {
    const { data, status } = useSession();

    return (
      <AuthSessionRuntimeContext.Provider
        value={{
          desktopRuntime: false,
          status,
          session: data ?? null,
        }}
      >
        {children}
      </AuthSessionRuntimeContext.Provider>
    );
  }

  return (
    <SessionProvider refetchOnWindowFocus refetchInterval={5 * 60}>
      <SessionRuntimeBridge>{children}</SessionRuntimeBridge>
    </SessionProvider>
  );
}

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [runtimeMode, setRuntimeMode] = useState<"pending" | "desktop" | "web">(
    "pending",
  );

  useEffect(() => {
    const nextDesktopRuntime = isTauri();
    setRuntimeMode(nextDesktopRuntime ? "desktop" : "web");
    if (!nextDesktopRuntime) {
      void ensureAppWarmup();
    }
  }, []);

  if (runtimeMode === "pending") {
    return (
      <AuthSessionRuntimeContext.Provider
        value={{
          desktopRuntime: false,
          status: "loading",
          session: null,
        }}
      >
        {children}
      </AuthSessionRuntimeContext.Provider>
    );
  }

  if (runtimeMode === "desktop") {
    return <DesktopSessionProvider>{children}</DesktopSessionProvider>;
  }

  return <WebSessionProvider>{children}</WebSessionProvider>;
}

export function useAuthSessionRuntime() {
  return useContext(AuthSessionRuntimeContext);
}
