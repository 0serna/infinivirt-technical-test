import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';

export function LoadErrorAlert({
  children,
  onRetry,
}: {
  children: string;
  onRetry: () => void;
}) {
  return (
    <Alert color="red" icon={<IconAlertCircle size={16} />}>
      <Stack gap="sm">
        <Text>{children}</Text>
        <Group>
          <Button
            type="button"
            variant="default"
            leftSection={<IconRefresh size={14} stroke={1.8} />}
            onClick={onRetry}
          >
            Try again
          </Button>
        </Group>
      </Stack>
    </Alert>
  );
}
