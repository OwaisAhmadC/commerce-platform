import Link from "next/link";
import { AdminGuard } from "../../components/AdminGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex flex-1 flex-col">
        <nav className="flex gap-4 border-b border-zinc-200 bg-zinc-50 px-6 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Link href="/admin/products" className="underline">
            Products
          </Link>
          <Link href="/admin/orders" className="underline">
            Orders
          </Link>
          <Link href="/admin/dashboard" className="underline">
            Dashboard
          </Link>
        </nav>
        {children}
      </div>
    </AdminGuard>
  );
}
