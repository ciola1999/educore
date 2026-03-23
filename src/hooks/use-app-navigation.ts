"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useAppNavigation() {
  return {
    pathname: usePathname(),
    router: useRouter(),
    searchParams: useSearchParams(),
  };
}
