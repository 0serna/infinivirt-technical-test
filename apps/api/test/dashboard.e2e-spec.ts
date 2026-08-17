import type { INestApplication } from '@nestjs/common';
import type {
  DashboardEnvelope,
  TicketListEnvelope,
  TicketListRow,
} from '@support-ticketing/shared';
import request from 'supertest';
import { createTestApp } from './create-test-app';
import { ADMIN_EMAIL, AGENT_EMAIL, SUPERVISOR_EMAIL } from './demo-credentials';
import { login } from './login';

function sortOldestUpdatedFirst(tickets: TicketListRow[]): TicketListRow[] {
  return [...tickets].sort((left, right) => {
    const byUpdated = left.updatedAt.localeCompare(right.updatedAt);
    if (byUpdated !== 0) {
      return byUpdated;
    }
    return left.id.localeCompare(right.id);
  });
}

describe('Dashboard (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /dashboard without a token returns the same opaque 401 as GET /auth/me', async () => {
    const me = await request(app.getHttpServer()).get('/auth/me').expect(401);
    const dashboard = await request(app.getHttpServer())
      .get('/dashboard')
      .expect(401);

    expect(dashboard.body).toEqual(me.body);
  });

  it('Agent GET /dashboard returns assigned-open load only (no team totals / Stale)', async () => {
    const agent = await login(app, AGENT_EMAIL);

    const listResponse = await request(app.getHttpServer())
      .get('/tickets')
      .query({ scope: 'assignedOpen' })
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .expect(200);
    const list = listResponse.body as TicketListEnvelope;
    const expectedShort = sortOldestUpdatedFirst(list.tickets).slice(0, 10);

    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .expect(200);

    const body = response.body as DashboardEnvelope;
    expect(body.kind).toBe('agent');
    if (body.kind !== 'agent') {
      return;
    }

    expect(body).not.toHaveProperty('openCount');
    expect(body).not.toHaveProperty('staleCount');
    expect(body).not.toHaveProperty('stale');
    expect(body).not.toHaveProperty('openByStatus');

    expect(body.assignedOpenCount).toBe(list.tickets.length);
    expect(body.assignedOpen.length).toBeLessThanOrEqual(10);
    expect(body.assignedOpen).toEqual(expectedShort);

    expect(
      body.assignedOpen.every((ticket) => ticket.assignee?.id === agent.userId),
    ).toBe(true);
    expect(
      body.assignedOpen.every((ticket) =>
        ['open', 'in_progress'].includes(ticket.status),
      ),
    ).toBe(true);

    const titles = body.assignedOpen.map((ticket) => ticket.title);
    expect(titles).not.toContain('High: patient portal MFA reset');
    expect(titles).not.toContain('High: warehouse scanner pairing');
    expect(titles).not.toContain('Resolved: gift-card balance mismatch');
  });

  it('Supervisor and Admin GET /dashboard return an interim team stub (F7.4 owns full metrics)', async () => {
    for (const email of [SUPERVISOR_EMAIL, ADMIN_EMAIL]) {
      const { accessToken } = await login(app, email);
      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        kind: 'team',
        openCount: 0,
        openByStatus: { open: 0, in_progress: 0 },
        staleCount: 0,
        stale: [],
      });
    }
  });
});
