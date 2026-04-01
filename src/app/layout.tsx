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
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              const isTauriRuntime =
                typeof window !== 'undefined' &&
                typeof window.__TAURI_INTERNALS__ !== 'undefined';

              window.addEventListener('load', function() {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  registrations.forEach(function(registration) {
                    void registration.unregister();
                  });
                }).catch(function() {
                  // Ignore cleanup failures.
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
