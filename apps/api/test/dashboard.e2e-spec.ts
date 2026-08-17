import type { INestApplication } from '@nestjs/common';
import {
  DASHBOARD_SHORT_LIST_CAP,
  type DashboardEnvelope,
  type TicketListEnvelope,
  type TicketListRow,
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
    const expectedShort = sortOldestUpdatedFirst(list.tickets).slice(
      0,
      DASHBOARD_SHORT_LIST_CAP,
    );

    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .expect(200);

    const body = response.body as DashboardEnvelope;
    expect(body.kind).toBe('agent');
    if (body.kind !== 'agent') {
      return;
    }

    expect(body).not.toHaveProperty('openTotal');
    expect(body).not.toHaveProperty('staleCount');
    expect(body).not.toHaveProperty('stale');
    expect(body).not.toHaveProperty('openByStatus');

    expect(body.openCount).toBe(list.tickets.length);
    expect(body.openTickets.length).toBeLessThanOrEqual(
      DASHBOARD_SHORT_LIST_CAP,
    );
    expect(body.openTickets).toEqual(expectedShort);

    expect(
      body.openTickets.every((ticket) => ticket.assignee?.id === agent.userId),
    ).toBe(true);
    expect(
      body.openTickets.every((ticket) =>
        ['open', 'in_progress'].includes(ticket.status),
      ),
    ).toBe(true);

    const titles = body.openTickets.map((ticket) => ticket.title);
    expect(titles).not.toContain('MFA reset emails not arriving');
    expect(titles).not.toContain('New scanners fail Bluetooth pairing');
    expect(titles).not.toContain('Gift card balance off after refund');
  });

  it('Supervisor and Admin GET /dashboard return the same team Open/Stale payload', async () => {
    const payloads: DashboardEnvelope[] = [];

    for (const email of [SUPERVISOR_EMAIL, ADMIN_EMAIL]) {
      const { accessToken } = await login(app, email);

      const [openLoad, openOnly, inProgress, staleList] = await Promise.all([
        request(app.getHttpServer())
          .get('/tickets')
          .query({ status: 'open,in_progress' })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200),
        request(app.getHttpServer())
          .get('/tickets')
          .query({ status: 'open' })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200),
        request(app.getHttpServer())
          .get('/tickets')
          .query({ status: 'in_progress' })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200),
        request(app.getHttpServer())
          .get('/tickets')
          .query({ stale: '1' })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200),
      ]);

      const openLoadBody = openLoad.body as TicketListEnvelope;
      const openOnlyBody = openOnly.body as TicketListEnvelope;
      const inProgressBody = inProgress.body as TicketListEnvelope;
      const staleBody = staleList.body as TicketListEnvelope;
      const expectedStaleShort = sortOldestUpdatedFirst(
        staleBody.tickets,
      ).slice(0, DASHBOARD_SHORT_LIST_CAP);

      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as DashboardEnvelope;
      expect(body.kind).toBe('team');
      if (body.kind !== 'team') {
        return;
      }

      expect(body).not.toHaveProperty('openTickets');

      expect(body.openTotal).toBe(openLoadBody.tickets.length);
      expect(body.openByStatus).toEqual({
        open: openOnlyBody.tickets.length,
        in_progress: inProgressBody.tickets.length,
      });
      expect(body.openTotal).toBe(
        body.openByStatus.open + body.openByStatus.in_progress,
      );
      expect(
        openLoadBody.tickets.every((ticket) =>
          ['open', 'in_progress'].includes(ticket.status),
        ),
      ).toBe(true);

      expect(body.staleCount).toBe(staleBody.tickets.length);
      expect(body.stale.length).toBeLessThanOrEqual(DASHBOARD_SHORT_LIST_CAP);
      expect(body.stale).toEqual(expectedStaleShort);
      expect(body.stale.every((ticket) => ticket.status !== 'closed')).toBe(
        true,
      );
      expect(body.stale.some((ticket) => ticket.status === 'resolved')).toBe(
        true,
      );
      expect(body.stale.map((ticket) => ticket.title)).not.toContain(
        'Dealer SSO onboarding',
      );
      expect(
        staleBody.tickets.every((ticket) => ticket.status !== 'closed'),
      ).toBe(true);
      expect(
        staleBody.tickets.some((ticket) => ticket.status === 'resolved'),
      ).toBe(true);

      payloads.push(body);
    }

    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toEqual(payloads[1]);
  });
});
