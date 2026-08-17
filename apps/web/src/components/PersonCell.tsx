import { Avatar, Group, Text } from '@mantine/core';

export function PersonCell({ name }: { name: string }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Avatar name={name} color="indigo" radius="xl" size={26} />
      <Text size="sm">{name}</Text>
    </Group>
  );
}
