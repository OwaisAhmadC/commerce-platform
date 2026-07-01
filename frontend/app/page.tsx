"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  timestamp: string;
  mongo: string;
};

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
    fetch(`${apiUrl}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        return res.json();
      })
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-16">
      <h1 className="text-2xl font-semibold">Commerce Platform — Phase 0 Scaffold</h1>
      {error && <p className="text-red-600">Backend unreachable: {error}</p>}
      {!error && !health && <p>Checking backend health...</p>}
      {health && (
        <pre className="rounded bg-zinc-100 p-4 text-sm dark:bg-zinc-900">
          {JSON.stringify(health, null, 2)}
        </pre>
      )}
    </main>
  );
}
