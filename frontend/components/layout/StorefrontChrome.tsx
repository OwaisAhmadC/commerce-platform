"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function StorefrontChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
