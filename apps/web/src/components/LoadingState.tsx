import { Center, Loader, Stack, Text } from '@mantine/core';

export function LoadingState({
  label,
  mih = 220,
}: {
  label: string;
  mih?: number | string;
}) {
  return (
    <Center py="xl" mih={mih}>
      <Stack align="center" gap="md">
        <Loader size="lg" type="dots" />
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Stack>
    </Center>
  );
}
