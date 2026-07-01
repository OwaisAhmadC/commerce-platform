"use client";

import Link from "next/link";
import { useAuth } from "../lib/auth/AuthContext";

export function NavBar() {
  const { user, logout, isLoading } = useAuth();

  return (
    <nav className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <Link href="/" className="font-semibold">
        Commerce Platform
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {isLoading ? null : user ? (
          <>
            <Link href="/cart" className="underline">
              Cart
            </Link>
            <span className="text-zinc-600 dark:text-zinc-400">
              {user.email} ({user.role})
            </span>
            <button type="button" onClick={logout} className="underline">
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="underline">
              Log in
            </Link>
            <Link href="/signup" className="underline">
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
