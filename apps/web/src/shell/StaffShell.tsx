import {
  AppShell,
  Avatar,
  Box,
  Burger,
  Button,
  Container,
  Divider,
  Group,
  Menu,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { Role } from '@support-ticketing/shared';
import {
  type Icon,
  IconBuildings,
  IconHeadset,
  IconLayoutDashboard,
  IconLogout,
  IconTicket,
  IconUsers,
} from '@tabler/icons-react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ROLE_LABEL } from '../users/roleLabels';

type NavItem = {
  to: string;
  label: string;
  icon: Icon;
  roles?: readonly Role[];
};

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  { to: '/tickets', label: 'Tickets', icon: IconTicket },
  {
    to: '/admin/clients',
    label: 'Clients',
    icon: IconBuildings,
    roles: ['admin'],
  },
  { to: '/admin/users', label: 'Users', icon: IconUsers, roles: ['admin'] },
];

function isNavActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function StaffShell() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const [mobileNavOpened, mobileNav] = useDisclosure();

  if (!user) {
    return null;
  }

  const items = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role),
  );

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="lg" wrap="nowrap">
            <Menu
              opened={mobileNavOpened}
              onChange={mobileNav.set}
              shadow="md"
              width={220}
            >
              <Menu.Target>
                <Burger
                  opened={mobileNavOpened}
                  size="sm"
                  hiddenFrom="sm"
                  aria-label="Toggle navigation"
                />
              </Menu.Target>
              <Menu.Dropdown>
                {items.map((item) => (
                  <Menu.Item
                    key={item.to}
                    component={Link}
                    to={item.to}
                    leftSection={<item.icon size={16} stroke={1.6} />}
                  >
                    {item.label}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon
                size={34}
                radius="md"
                variant="gradient"
                gradient={{ from: 'indigo', to: 'violet', deg: 135 }}
              >
                <IconHeadset size={18} stroke={1.8} />
              </ThemeIcon>
              <Title order={1} size="h4" visibleFrom="xs">
                <Link
                  to="/"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  Support Ticketing
                </Link>
              </Title>
            </Group>
            <Group
              gap={4}
              visibleFrom="sm"
              component="nav"
              aria-label="Primary"
              wrap="nowrap"
            >
              {items.map((item) => {
                const active = isNavActive(pathname, item.to);
                return (
                  <Button
                    key={item.to}
                    component={Link}
                    to={item.to}
                    size="sm"
                    variant={active ? 'light' : 'subtle'}
                    color={active ? 'indigo' : 'gray'}
                    leftSection={<item.icon size={16} stroke={1.6} />}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Group>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Avatar
              name={user.displayName}
              color="indigo"
              radius="xl"
              size={34}
            />
            <Box visibleFrom="sm">
              <Text size="sm" fw={600} lh={1.25}>
                {user.displayName}
              </Text>
              <Text size="xs" c="dimmed" lh={1.25}>
                {ROLE_LABEL[user.role]}
              </Text>
            </Box>
            <Divider
              orientation="vertical"
              h={26}
              style={{ alignSelf: 'center' }}
            />
            <Button
              type="button"
              variant="subtle"
              color="gray"
              size="sm"
              leftSection={<IconLogout size={16} stroke={1.6} />}
              onClick={signOut}
            >
              Sign out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="xl" px={0}>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
