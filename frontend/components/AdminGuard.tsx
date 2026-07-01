"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "../lib/auth/AuthContext";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <main className="p-6 text-sm text-zinc-500">Loading...</main>;
  }

  if (!user || user.role !== "admin") {
    return (
      <main className="p-6">
        <p className="text-sm text-red-600">
          Access denied. This section is for admin accounts only.
        </p>
        <Link href="/" className="text-sm underline">
          Back to storefront
        </Link>
      </main>
    );
  }

  return <>{children}</>;
}
