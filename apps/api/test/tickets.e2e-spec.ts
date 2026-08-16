import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';
import {
  ADMIN_EMAIL,
  AGENT_EMAIL,
  DEMO_PASSWORD,
  SUPERVISOR_EMAIL,
} from './demo-credentials';

async function login(
  app: INestApplication,
  email: string,
): Promise<{ accessToken: string; userId: string }> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: DEMO_PASSWORD })
    .expect(200);
  return {
    accessToken: response.body.accessToken as string,
    userId: response.body.user.id as string,
  };
}

function titles(body: { tickets?: Array<{ title?: string }> }): string[] {
  return (body.tickets ?? []).map((ticket) => ticket.title ?? '');
}

describe('Tickets list (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /tickets without a token returns the same opaque 401 as GET /auth/me', async () => {
    const me = await request(app.getHttpServer()).get('/auth/me').expect(401);
    const tickets = await request(app.getHttpServer())
      .get('/tickets')
      .expect(401);

    expect(tickets.body).toEqual(me.body);
  });

  it('Agent List Scope includes Tickets they created, including unassigned and assigned to another User', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const response = await request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(titles(response.body)).toEqual(
      expect.arrayContaining([
        'High: patient portal MFA reset',
        'Resolved: SSO redirect loop',
        'Stale open: billing portal timeout',
      ]),
    );
  });

  it('Agent List Scope excludes unassigned Tickets they did not create and Tickets assigned only to others', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const response = await request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const listed = titles(response.body);
    expect(listed).not.toContain('High: warehouse scanner pairing');
    expect(listed).not.toContain('Closed (older): dealer SSO onboarding');
  });

  it('Supervisor and Administrator see a strictly wider List Scope than the Agent', async () => {
    const agent = await login(app, AGENT_EMAIL);
    const supervisor = await login(app, SUPERVISOR_EMAIL);
    const admin = await login(app, ADMIN_EMAIL);

    const agentList = await request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .expect(200);
    const supervisorList = await request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', `Bearer ${supervisor.accessToken}`)
      .expect(200);
    const adminList = await request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const agentTitles = titles(agentList.body);
    const supervisorTitles = titles(supervisorList.body);
    const adminTitles = titles(adminList.body);

    expect(supervisorTitles.length).toBeGreaterThan(agentTitles.length);
    expect(adminTitles.length).toBeGreaterThan(agentTitles.length);
    expect(supervisorTitles).toEqual(
      expect.arrayContaining([
        ...agentTitles,
        'High: warehouse scanner pairing',
        'Closed (older): dealer SSO onboarding',
      ]),
    );
    expect(adminTitles).toEqual(
      expect.arrayContaining([
        ...agentTitles,
        'High: warehouse scanner pairing',
        'Closed (older): dealer SSO onboarding',
      ]),
    );
  });

  it('List Scope comes from the authenticated User, not a User id query param', async () => {
    const agent = await login(app, AGENT_EMAIL);
    const supervisor = await login(app, SUPERVISOR_EMAIL);

    const response = await request(app.getHttpServer())
      .get('/tickets')
      .query({ userId: supervisor.userId, assigneeId: supervisor.userId })
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .expect(200);

    const listed = titles(response.body);
    expect(listed).not.toContain('High: warehouse scanner pairing');
    expect(listed).toContain('High: patient portal MFA reset');
  });

  it('each Ticket row has list fields only and omits description, Comments, and history', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const response = await request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const row = response.body.tickets.find(
      (ticket: { title: string }) =>
        ticket.title === 'High: patient portal MFA reset',
    );
    expect(row).toEqual({
      id: expect.any(String),
      title: 'High: patient portal MFA reset',
      status: 'open',
      priority: 'high',
      client: { id: expect.any(String), name: 'Contoso Health' },
      assignee: null,
      createdBy: { id: expect.any(String), displayName: 'Alex Agent' },
      updatedAt: expect.any(String),
      createdAt: expect.any(String),
    });
    expect(row).not.toHaveProperty('description');
    expect(row).not.toHaveProperty('comments');
    expect(row).not.toHaveProperty('statusHistory');
    expect(row).not.toHaveProperty('assignments');
  });

  it('tickets are ordered by updatedAt descending with id as a stable secondary key and include every Status in scope', async () => {
    const { accessToken } = await login(app, SUPERVISOR_EMAIL);
    const response = await request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const tickets = response.body.tickets as Array<{
      id: string;
      status: string;
      updatedAt: string;
    }>;
    expect(tickets.length).toBeGreaterThan(1);

    for (let index = 1; index < tickets.length; index += 1) {
      const previous = tickets[index - 1];
      const current = tickets[index];
      const previousTime = Date.parse(previous.updatedAt);
      const currentTime = Date.parse(current.updatedAt);
      expect(previousTime).toBeGreaterThanOrEqual(currentTime);
      if (previousTime === currentTime) {
        expect(previous.id <= current.id).toBe(true);
      }
    }

    expect(new Set(tickets.map((ticket) => ticket.status))).toEqual(
      new Set(['open', 'in_progress', 'resolved', 'closed']),
    );
  });
});
