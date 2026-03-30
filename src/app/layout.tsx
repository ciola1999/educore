import type { Metadata } from "next";
import Script from "next/script";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { AuthSessionProvider } from "@/components/providers/auth-session-provider";
import { primeServerRuntimeWarmup } from "@/lib/runtime/server-warmup";
import "./globals.css";

export const metadata: Metadata = {
  title: "Educore - School Management System",
  description: "Local-first Education Management",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  primeServerRuntimeWarmup();

  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#000000" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.libsql.org https://*.turso.io tauri://localhost ipc: http://ipc.localhost ws://localhost:* http://localhost:*;"
        />
      </head>
      <body className="font-sans antialiased">
        <AuthSessionProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
        </AuthSessionProvider>
        <Toaster position="top-right" richColors closeButton />
        <Script id="runtime-warmup" strategy="beforeInteractive">
          {`
            (function() {
              try {
                var isTauriRuntime =
                  typeof window !== 'undefined' &&
                  (
                    typeof window.__TAURI_INTERNALS__ !== 'undefined' ||
                    typeof window.__TAURI__ !== 'undefined' ||
                    (typeof navigator !== 'undefined' &&
                      typeof navigator.userAgent === 'string' &&
                      navigator.userAgent.indexOf('Tauri') !== -1) ||
                    (typeof window.location !== 'undefined' &&
                      window.location.protocol === 'tauri:')
                  );
                var shouldWarm =
                  typeof window !== 'undefined' &&
                  (window.location.pathname === '/' ||
                    window.location.pathname === '/login' ||
                    window.location.pathname.indexOf('/dashboard') === 0) &&
                  !isTauriRuntime;

                if (!shouldWarm) {
                  return;
                }

                void fetch('/api/runtime/warmup', {
                  method: 'GET',
                  credentials: 'include',
                  cache: 'no-store',
                  headers: {
                    'x-educore-warmup': '1'
                  }
                }).catch(function(error) {
                  console.warn('[BOOTSTRAP] beforeInteractive warmup skipped', error);
                });
              } catch (error) {
                console.warn('[BOOTSTRAP] beforeInteractive warmup failed', error);
              }
            })();
          `}
        </Script>
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              const isTauriRuntime =
                typeof window !== 'undefined' &&
                typeof window.__TAURI_INTERNALS__ !== 'undefined';
              const shouldRegisterServiceWorker =
                !isTauriRuntime && window.location.protocol !== 'http:';

              window.addEventListener('load', function() {
                if (!shouldRegisterServiceWorker) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    registrations.forEach(function(registration) {
                      void registration.unregister();
                    });
                  });
                  return;
                }

                navigator.serviceWorker.register('/sw.js').catch(function() {
                  // Ignore registration failures in runtime-specific contexts.
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
