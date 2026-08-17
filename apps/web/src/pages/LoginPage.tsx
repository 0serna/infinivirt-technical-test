import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconHeadset,
  IconLock,
  IconMail,
} from '@tabler/icons-react';
import { type FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ROLE_LABEL } from '../users/roleLabels';

const DEMO_PASSWORD = 'DemoPassword123!';

const DEMO_ACCOUNTS = [
  { email: 'agent@example.com', role: 'agent' },
  { email: 'supervisor@example.com', role: 'supervisor' },
  { email: 'admin@example.com', role: 'admin' },
] as const;

export function LoginPage() {
  const { signIn, sessionExpired } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email === '' || password === '') {
      setError('Email and password are required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (result === 'ok') {
        return;
      }
      setError(
        result === 'unauthorized'
          ? 'Sign in failed.'
          : "Can't reach the server. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemoAccount(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <Center mih="100vh" p="md" bg="gray.0">
      <Stack w="100%" maw={400} gap="lg">
        <Group justify="center" gap="sm">
          <ThemeIcon
            size={40}
            variant="gradient"
            gradient={{ from: 'indigo', to: 'violet', deg: 135 }}
          >
            <IconHeadset size={22} stroke={1.8} />
          </ThemeIcon>
          <Text size="xl" fw={700}>
            Support Ticketing
          </Text>
        </Group>
        <Card withBorder shadow="sm" radius="lg" p="xl">
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {sessionExpired ? (
                <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
                  Your session expired. Sign in again.
                </Alert>
              ) : null}
              {error ? (
                <Alert color="red" icon={<IconAlertCircle size={16} />}>
                  {error}
                </Alert>
              ) : null}
              <TextInput
                label="Email"
                type="email"
                placeholder="you@example.com"
                leftSection={<IconMail size={16} stroke={1.6} />}
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                disabled={submitting}
              />
              <PasswordInput
                label="Password"
                placeholder="Your password"
                leftSection={<IconLock size={16} stroke={1.6} />}
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                disabled={submitting}
                visibilityToggleButtonProps={{
                  // Avoid "password" in the label — getByLabel('Password') would
                  // also match "Toggle password visibility".
                  'aria-label': 'Show or hide characters',
                }}
              />
              <Button type="submit" fullWidth size="md" loading={submitting}>
                Sign in
              </Button>
            </Stack>
          </form>
        </Card>
        <Box>
          <Divider label="Demo accounts" labelPosition="center" />
          <Stack gap={6} mt="sm">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                type="button"
                variant="subtle"
                color="gray"
                fullWidth
                size="sm"
                justify="space-between"
                rightSection={
                  <Badge size="sm" variant="light" color="indigo" radius="sm">
                    {ROLE_LABEL[account.role]}
                  </Badge>
                }
                onClick={() => fillDemoAccount(account.email)}
              >
                {account.email}
              </Button>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Center>
  );
}
