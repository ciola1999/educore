import { Suspense } from "react";
import { LoginForm } from "@/components/login/login-form";

export function LoginPageShell() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-blue-500 opacity-20 blur-[100px]" />

      <div className="z-10 flex w-full flex-col items-center gap-8">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white lg:text-5xl">
            Educore
          </h1>
          <p className="text-zinc-400">Integrated School Management System</p>
        </div>

        <Suspense fallback={<div className="h-[29rem] w-full max-w-sm" />}>
          <LoginForm />
        </Suspense>

        <p className="mt-8 font-mono text-xs text-zinc-600">
          v1.0.0 (Local-First Architecture)
        </p>
      </div>
    </main>
  );
}
