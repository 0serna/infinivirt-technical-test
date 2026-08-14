import { useEffect, useState } from 'react';

type HealthResponse = {
  status: string;
};

export function App() {
  const [health, setHealth] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/health')
      .then((response) => response.json() as Promise<HealthResponse>)
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
