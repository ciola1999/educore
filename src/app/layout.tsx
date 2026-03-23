import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { AuthSessionProvider } from "@/components/providers/auth-session-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
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
