import { useEffect, useState } from 'react';

export function App() {
  const [health, setHealth] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/health')
      .then((response) => response.json() as Promise<{ status: string }>)
      .then((data) => setHealth(data.status));
  }, []);

  return (
    <main>
      <h1>Support Ticketing</h1>
      <p>
        API health: <span>{health ?? 'loading'}</span>
      </p>
    </main>
  );
}
