import {
  Alert,
  Button,
  Center,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

export function LoginPage() {
  const { signIn, sessionExpired } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email === '' || password === '') {
      setError('Email and password are required.');
      return;
    }
    setError(null);

    const result = await signIn(email, password);
    if (result === 'ok') {
      return;
    }
    setError(
      result === 'unauthorized'
        ? 'Sign in failed.'
        : "Can't reach the server. Try again.",
    );
  }

  return (
    <Center mih="100vh" p="xl">
      <form onSubmit={handleSubmit}>
        <Stack w="100%" maw="24rem">
          <Title order={1}>Sign in</Title>
          {sessionExpired ? (
            <Alert>Your session expired. Sign in again.</Alert>
          ) : null}
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          {error ? <Text c="red">{error}</Text> : null}
          <Button type="submit">Sign in</Button>
        </Stack>
      </form>
    </Center>
  );
}
