import { MantineProvider, Text, Title } from '@mantine/core';
import { ROLES, type Role } from '@support-ticketing/shared';
import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

const knownRoles: readonly Role[] = ROLES;

export function App() {
  if (knownRoles.length === 0) {
    throw new Error('Role catalog is empty');
  }

  return (
    <MantineProvider defaultColorScheme="light">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PlaceholderPage />} />
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  );
}

function PlaceholderPage() {
  const [health, setHealth] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/health')
      .then((response) => response.json() as Promise<{ status: string }>)
      .then((data) => setHealth(data.status));
  }, []);

  return (
    <main>
      <Title order={1}>Support Ticketing</Title>
      <Text>
        API health: <span>{health ?? 'loading'}</span>
      </Text>
    </main>
  );
}
