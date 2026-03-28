"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthRole } from "@/core/auth/roles";
import { isTauri } from "@/core/env";
import { useAuth } from "@/hooks/use-auth";
import { DASHBOARD_ROLE_DEFAULT_PATH } from "@/lib/auth/dashboard-access";
import { getRuntimeDefaultDashboardPath } from "@/lib/runtime/desktop-dashboard";
import { useStore } from "@/lib/store/use-store";

// --- SENSORY UTILS (Fitur Baru) ---
const triggerErrorHaptic = () => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([100, 50, 100]); // Getar bzz-bzz
  }
};

const playSuccessSound = () => {
  const audioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (audioContextCtor) {
    const ctx = new audioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Nada Futuristik Halus
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1); // Slide ke E5

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function resolveCallbackUrl() {
    const value = searchParams.get("callbackUrl")?.trim();
    if (!value) {
      return "/dashboard";
    }

    if (!value.startsWith("/")) {
      return "/dashboard";
    }

    if (value.startsWith("//")) {
      return "/dashboard";
    }

    return value;
  }

  function resolveDesktopDefaultUrl() {
    const currentRole = useStore.getState().user?.role as AuthRole | undefined;
    if (!currentRole) {
      return "/dashboard/settings";
    }

    return getRuntimeDefaultDashboardPath(
      currentRole,
      DASHBOARD_ROLE_DEFAULT_PATH[currentRole],
    );
  }

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const target = event.target as typeof event.target & {
      email: { value: string };
      password: { value: string };
    };

    const email = target.email.value;
    const password = target.password.value;

    try {
      const result = await login(email, password);

      if (result.success) {
        playSuccessSound();
        router.replace(
          isTauri() ? resolveDesktopDefaultUrl() : resolveCallbackUrl(),
        );
      } else {
        triggerErrorHaptic();
        setError(result.error);
        setIsLoading(false);
      }
    } catch (e) {
      triggerErrorHaptic();
      console.error("Login error:", e);
      setError("Terjadi kesalahan sistem");
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm bg-zinc-900/90 border-zinc-800 text-zinc-100 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
          Educore Access
        </CardTitle>
        <CardDescription className="text-center text-zinc-400">
          Local-First School System
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="grid gap-4">
          {error && (
            <div className="p-3 rounded bg-red-900/30 border border-red-800 text-red-200 text-sm flex items-center gap-2 animate-pulse">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="email">Email / Username / NIP / NIS</Label>
            <Input
              id="email"
              name="email"
              type="text"
              placeholder="admin@educore.school, guru, NIP, atau NIS"
              className="bg-zinc-950/50 border-zinc-700 focus-visible:ring-blue-500 transition-all"
              disabled={isLoading}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              className="bg-zinc-950/50 border-zinc-700 focus-visible:ring-blue-500 transition-all"
              disabled={isLoading}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="pt-6">
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Masuk"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
