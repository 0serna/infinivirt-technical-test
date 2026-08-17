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

type TicketDetailBody = {
  id: string;
  title: string;
  description?: string;
  status: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  assignee: { id: string; displayName: string } | null;
  statusHistory: Array<{
    from: string | null;
    to: string;
    changedAt: string;
    changedBy: { id: string; displayName: string };
  }>;
  comments: Array<{
    id: string;
    body: string;
    visibility: string;
    createdAt: string;
    author: { id: string; displayName: string };
  }>;
};

async function ticketByTitle(
  app: INestApplication,
  accessToken: string,
  title: string,
): Promise<TicketDetailBody> {
  const list = await request(app.getHttpServer())
    .get('/tickets')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  const listed = (
    list.body.tickets as Array<{ id: string; title: string }>
  ).find((ticket) => ticket.title === title);
  expect(listed).toBeDefined();
  const detail = await request(app.getHttpServer())
    .get(`/tickets/${listed?.id}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  return detail.body;
}

function expectLatestTransition(
  body: TicketDetailBody,
  expected: {
    from: string | null;
    to: string;
    changedBy: { id: string; displayName: string };
  },
): void {
  expect(body.statusHistory[body.statusHistory.length - 1]).toEqual({
    ...expected,
    changedAt: expect.any(String),
  });
}

async function expectPatchForbiddenUnchanged(
  app: INestApplication,
  accessToken: string,
  title: string,
  status: string,
  extras?: (before: TicketDetailBody, after: TicketDetailBody) => void,
): Promise<void> {
  const before = await ticketByTitle(app, accessToken, title);
  await request(app.getHttpServer())
    .patch(`/tickets/${before.id}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ status })
    .expect(403);
  const after = await ticketByTitle(app, accessToken, title);
  expect(after.status).toBe(before.status);
  expect(after.updatedAt).toBe(before.updatedAt);
  expect(after.statusHistory).toEqual(before.statusHistory);
  extras?.(before, after);
}

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app?.close();
});

describe('Tickets list (e2e)', () => {
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

  it('status restricts tickets while filterOptions stay on the unfiltered List Scope', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const response = await request(app.getHttpServer())
      .get('/tickets')
      .query({ status: 'resolved' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(titles(response.body)).toEqual(
      expect.arrayContaining(['Resolved: SSO redirect loop']),
    );
    expect(titles(response.body)).not.toContain(
      'High: patient portal MFA reset',
    );
    expect(
      (response.body.tickets as Array<{ status: string }>).every(
        (ticket) => ticket.status === 'resolved',
      ),
    ).toBe(true);

    const clientNames = (
      response.body.filterOptions.clients as Array<{ name: string }>
    ).map((client) => client.name);
    expect(clientNames).toEqual(
      expect.arrayContaining(['Contoso Health', 'Initech Soft']),
    );

    expect(response.body.filterOptions.includeUnassigned).toBe(true);
    expect(response.body.filterOptions.assignees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayName: 'Sam Supervisor' }),
      ]),
    );
    expect(response.body.filterOptions.assignees).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'unassigned' })]),
    );
  });

  it('status, priority, and clientId restrict tickets with AND', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const unfiltered = await request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const contoso = (
      unfiltered.body.filterOptions.clients as Array<{
        id: string;
        name: string;
      }>
    ).find((client) => client.name === 'Contoso Health');
    expect(contoso).toBeDefined();

    const response = await request(app.getHttpServer())
      .get('/tickets')
      .query({
        status: 'open',
        priority: 'high',
        clientId: contoso?.id,
      })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(titles(response.body)).toContain('High: patient portal MFA reset');
    expect(titles(response.body)).not.toContain('High: appointment sync lag');
    expect(titles(response.body)).not.toContain(
      'Resolved: fax gateway retry storm',
    );
    expect(titles(response.body)).not.toContain('Resolved: SSO redirect loop');
  });

  it('Supervisor can restrict by Assignee UUID or unassigned', async () => {
    const supervisor = await login(app, SUPERVISOR_EMAIL);
    const byAssignee = await request(app.getHttpServer())
      .get('/tickets')
      .query({ assigneeId: supervisor.userId })
      .set('Authorization', `Bearer ${supervisor.accessToken}`)
      .expect(200);

    expect(titles(byAssignee.body)).toContain('Resolved: SSO redirect loop');
    expect(titles(byAssignee.body)).not.toContain(
      'High: patient portal MFA reset',
    );
    expect(titles(byAssignee.body)).not.toContain(
      'High: warehouse scanner pairing',
    );

    const unassigned = await request(app.getHttpServer())
      .get('/tickets')
      .query({ assigneeId: 'unassigned' })
      .set('Authorization', `Bearer ${supervisor.accessToken}`)
      .expect(200);

    expect(titles(unassigned.body)).toEqual(
      expect.arrayContaining([
        'High: patient portal MFA reset',
        'High: warehouse scanner pairing',
      ]),
    );
    expect(titles(unassigned.body)).not.toContain(
      'Resolved: SSO redirect loop',
    );
  });

  it('Agent assigneeId is ignored and does not widen List Scope', async () => {
    const agent = await login(app, AGENT_EMAIL);
    const supervisor = await login(app, SUPERVISOR_EMAIL);

    const response = await request(app.getHttpServer())
      .get('/tickets')
      .query({ assigneeId: supervisor.userId })
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .expect(200);

    expect(titles(response.body)).toContain('High: patient portal MFA reset');
    expect(titles(response.body)).toContain('Resolved: SSO redirect loop');
    expect(titles(response.body)).not.toContain(
      'High: warehouse scanner pairing',
    );
  });

  it('invalid status, priority, clientId, or assigneeId return HTTP 400 without a stack', async () => {
    const { accessToken } = await login(app, SUPERVISOR_EMAIL);

    const status = await request(app.getHttpServer())
      .get('/tickets')
      .query({ status: 'not-a-status' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
    const priority = await request(app.getHttpServer())
      .get('/tickets')
      .query({ priority: 'urgent' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
    const clientId = await request(app.getHttpServer())
      .get('/tickets')
      .query({ clientId: 'not-a-uuid' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
    const assigneeId = await request(app.getHttpServer())
      .get('/tickets')
      .query({ assigneeId: 'not-a-uuid' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    for (const response of [status, priority, clientId, assigneeId]) {
      expect(response.body).not.toHaveProperty('stack');
      expect(JSON.stringify(response.body)).not.toMatch(/TicketsService/);
    }
  });

  it('Agent sending an invalid assigneeId does not 400', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const response = await request(app.getHttpServer())
      .get('/tickets')
      .query({ assigneeId: 'not-a-uuid' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(titles(response.body)).toContain('High: patient portal MFA reset');
  });

  it('unknown query params do not 500', async () => {
    const { accessToken } = await login(app, SUPERVISOR_EMAIL);
    const response = await request(app.getHttpServer())
      .get('/tickets')
      .query({ unknown: 'value', status: 'open' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(titles(response.body)).toContain('High: warehouse scanner pairing');
    expect(titles(response.body)).not.toContain('Resolved: SSO redirect loop');
  });
});

describe('Tickets get by id (e2e)', () => {
  it('GET /tickets/:id without a token returns the same opaque 401 as GET /auth/me', async () => {
    const me = await request(app.getHttpServer()).get('/auth/me').expect(401);
    const ticket = await request(app.getHttpServer())
      .get('/tickets/00000000-0000-4000-8000-000000000001')
      .expect(401);

    expect(ticket.body).toEqual(me.body);
  });

  it('Agent GET of a Ticket they created (unassigned) returns current fields, Comments, and Status Transition history', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const body = await ticketByTitle(
      app,
      accessToken,
      'High: patient portal MFA reset',
    );

    expect(body).toEqual({
      id: body.id,
      title: 'High: patient portal MFA reset',
      description: 'MFA reset emails not arriving.',
      status: 'open',
      priority: 'high',
      client: { id: expect.any(String), name: 'Contoso Health' },
      assignee: null,
      createdBy: { id: expect.any(String), displayName: 'Alex Agent' },
      updatedAt: expect.any(String),
      createdAt: expect.any(String),
      resolvedAt: null,
      closedAt: null,
      statusHistory: [
        {
          from: null,
          to: 'open',
          changedAt: expect.any(String),
          changedBy: { id: expect.any(String), displayName: 'Alex Agent' },
        },
      ],
      comments: [
        {
          id: expect.any(String),
          body: 'Created; needs assignment.',
          visibility: 'public',
          createdAt: expect.any(String),
          author: { id: expect.any(String), displayName: 'Alex Agent' },
        },
      ],
    });
    expect(body).not.toHaveProperty('assignments');
  });

  it('Agent GET of a Ticket where they are Assignee includes full Status Transition history oldest first', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const body = await ticketByTitle(
      app,
      accessToken,
      'Reopened: returns portal blank page',
    );

    expect(body.title).toBe('Reopened: returns portal blank page');
    expect(body.status).toBe('open');
    expect(body.assignee).toEqual({
      id: expect.any(String),
      displayName: 'Alex Agent',
    });
    expect(body.resolvedAt).toBeNull();
    expect(body.closedAt).toBeNull();
    expect(body.statusHistory.map((row) => [row.from, row.to])).toEqual([
      [null, 'open'],
      ['open', 'in_progress'],
      ['in_progress', 'resolved'],
      ['resolved', 'closed'],
      ['closed', 'open'],
    ]);
    const changedAt = body.statusHistory.map((row) =>
      Date.parse(row.changedAt),
    );
    for (let index = 1; index < changedAt.length; index += 1) {
      expect(changedAt[index]).toBeGreaterThanOrEqual(changedAt[index - 1]);
    }
    expect(body.comments).toEqual([
      {
        id: expect.any(String),
        body: 'Reopened after regression report; prior closed cycle kept in history.',
        visibility: 'internal',
        createdAt: expect.any(String),
        author: { id: expect.any(String), displayName: 'Ada Admin' },
      },
      {
        id: expect.any(String),
        body: 'Investigating blank page on returns portal again.',
        visibility: 'public',
        createdAt: expect.any(String),
        author: { id: expect.any(String), displayName: 'Alex Agent' },
      },
    ]);
    expect(body).not.toHaveProperty('assignments');
  });

  it('Agent GET includes public and internal Comments oldest first on an in-scope Ticket', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const body = await ticketByTitle(
      app,
      accessToken,
      'In progress: shipment tracking API',
    );

    expect(body.comments.map((row) => [row.visibility, row.body])).toEqual([
      ['public', 'Reproduced against staging; checking gateway logs.'],
      ['internal', 'Escalate to platform if still failing after deploy.'],
    ]);
    expect(body.comments.map((row) => row.author.displayName)).toEqual([
      'Alex Agent',
      'Sam Supervisor',
    ]);
    const createdAt = body.comments.map((row) => Date.parse(row.createdAt));
    for (let index = 1; index < createdAt.length; index += 1) {
      expect(createdAt[index]).toBeGreaterThanOrEqual(createdAt[index - 1]);
    }
    for (const comment of body.comments) {
      expect(comment).toEqual({
        id: expect.any(String),
        body: expect.any(String),
        visibility: expect.any(String),
        createdAt: expect.any(String),
        author: { id: expect.any(String), displayName: expect.any(String) },
      });
    }
  });

  it('Agent GET of an in-scope Ticket with no Comments returns an empty thread', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const body = await ticketByTitle(
      app,
      accessToken,
      'High: appointment sync lag',
    );

    expect(body.comments).toEqual([]);
  });

  it('Agent GET of a Ticket they created that is assigned to another User includes resolvedAt', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const body = await ticketByTitle(
      app,
      accessToken,
      'Resolved: SSO redirect loop',
    );

    expect(body.title).toBe('Resolved: SSO redirect loop');
    expect(body.status).toBe('resolved');
    expect(body.resolvedAt).toEqual(expect.any(String));
    expect(body.closedAt).toBeNull();
    expect(body.assignee).toEqual({
      id: expect.any(String),
      displayName: 'Sam Supervisor',
    });
  });

  it('Agent cannot distinguish a well-formed unknown id from a Ticket outside List Scope', async () => {
    const agent = await login(app, AGENT_EMAIL);
    const supervisor = await login(app, SUPERVISOR_EMAIL);
    const outOfScope = await ticketByTitle(
      app,
      supervisor.accessToken,
      'High: warehouse scanner pairing',
    );

    const unknownId = '00000000-0000-4000-8000-000000000099';
    const unknown = await request(app.getHttpServer())
      .get(`/tickets/${unknownId}`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .expect(404);
    const hidden = await request(app.getHttpServer())
      .get(`/tickets/${outOfScope.id}`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .expect(404);

    expect(unknown.body).toEqual(hidden.body);
    expect(JSON.stringify(unknown.body)).not.toMatch(/warehouse scanner/);
    expect(JSON.stringify(hidden.body)).not.toMatch(/warehouse scanner/);
  });

  it('Supervisor and Administrator can GET Tickets the Agent cannot', async () => {
    const agent = await login(app, AGENT_EMAIL);
    const supervisor = await login(app, SUPERVISOR_EMAIL);
    const admin = await login(app, ADMIN_EMAIL);
    const warehouse = await ticketByTitle(
      app,
      supervisor.accessToken,
      'High: warehouse scanner pairing',
    );

    await request(app.getHttpServer())
      .get(`/tickets/${warehouse.id}`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .expect(404);

    const asSupervisor = await request(app.getHttpServer())
      .get(`/tickets/${warehouse.id}`)
      .set('Authorization', `Bearer ${supervisor.accessToken}`)
      .expect(200);
    const asAdmin = await request(app.getHttpServer())
      .get(`/tickets/${warehouse.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(asSupervisor.body.title).toBe('High: warehouse scanner pairing');
    expect(asAdmin.body.title).toBe('High: warehouse scanner pairing');
    expect(asSupervisor.body.description).toBe(
      'New scanners fail Bluetooth pairing.',
    );

    const closed = await ticketByTitle(
      app,
      supervisor.accessToken,
      'Closed (older): dealer SSO onboarding',
    );
    await request(app.getHttpServer())
      .get(`/tickets/${closed.id}`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .expect(404);
    const closedBody = await request(app.getHttpServer())
      .get(`/tickets/${closed.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(closedBody.body.closedAt).toEqual(expect.any(String));
    expect(closedBody.body.resolvedAt).toEqual(expect.any(String));
  });

  it('malformed Ticket id returns HTTP 400 without a stack', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const response = await request(app.getHttpServer())
      .get('/tickets/not-a-uuid')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body).not.toHaveProperty('stack');
    expect(JSON.stringify(response.body)).not.toMatch(/TicketsService/);
  });
});

describe('Tickets status transition (e2e)', () => {
  it('PATCH /tickets/:id without a token returns the same opaque 401 as GET /auth/me', async () => {
    const me = await request(app.getHttpServer()).get('/auth/me').expect(401);
    const patched = await request(app.getHttpServer())
      .patch('/tickets/00000000-0000-4000-8000-000000000001')
      .send({ status: 'in_progress' })
      .expect(401);

    expect(patched.body).toEqual(me.body);
  });

  it('malformed Ticket id on PATCH returns HTTP 400 without a stack', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const response = await request(app.getHttpServer())
      .patch('/tickets/not-a-uuid')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'in_progress' })
      .expect(400);

    expect(response.body).not.toHaveProperty('stack');
    expect(JSON.stringify(response.body)).not.toMatch(/TicketsService/);
  });

  it('Agent PATCH of a well-formed unknown id matches PATCH outside List Scope and GET 404', async () => {
    const agent = await login(app, AGENT_EMAIL);
    const supervisor = await login(app, SUPERVISOR_EMAIL);
    const warehouse = await ticketByTitle(
      app,
      supervisor.accessToken,
      'High: warehouse scanner pairing',
    );

    const unknownId = '00000000-0000-4000-8000-000000000099';
    const getUnknown = await request(app.getHttpServer())
      .get(`/tickets/${unknownId}`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .expect(404);
    const patchUnknown = await request(app.getHttpServer())
      .patch(`/tickets/${unknownId}`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .send({ status: 'in_progress' })
      .expect(404);
    const patchHidden = await request(app.getHttpServer())
      .patch(`/tickets/${warehouse.id}`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .send({ status: 'in_progress' })
      .expect(404);

    expect(patchUnknown.body).toEqual(getUnknown.body);
    expect(patchHidden.body).toEqual(getUnknown.body);
    expect(JSON.stringify(patchHidden.body)).not.toMatch(/warehouse scanner/);
  });

  it('Agent creator of an unassigned Ticket cannot record a Status Transition', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    await expectPatchForbiddenUnchanged(
      app,
      accessToken,
      'High: patient portal MFA reset',
      'in_progress',
      (before) => expect(before.status).toBe('open'),
    );
  });

  it('Supervisor who is not Assignee cannot record a forward Status Transition', async () => {
    const supervisor = await login(app, SUPERVISOR_EMAIL);
    await expectPatchForbiddenUnchanged(
      app,
      supervisor.accessToken,
      'High: warehouse scanner pairing',
      'in_progress',
      (before) => expect(before.status).toBe('open'),
    );
  });

  it('Agent who created a Ticket assigned to another User cannot transition it', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    await expectPatchForbiddenUnchanged(
      app,
      accessToken,
      'Resolved: SSO redirect loop',
      'closed',
      (before) => expect(before.status).toBe('resolved'),
    );
  });

  it('skip and same Status return 409 with no write, including for Administrator', async () => {
    const admin = await login(app, ADMIN_EMAIL);
    const ticket = await ticketByTitle(
      app,
      admin.accessToken,
      'High: patient portal MFA reset',
    );
    expect(ticket.status).toBe('open');

    const same = await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'open' })
      .expect(409);
    const skipResolved = await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'resolved' })
      .expect(409);
    const skipClosed = await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'closed' })
      .expect(409);

    for (const response of [same, skipResolved, skipClosed]) {
      expect(response.body).not.toHaveProperty('stack');
    }

    const after = await ticketByTitle(
      app,
      admin.accessToken,
      'High: patient portal MFA reset',
    );
    expect(after.status).toBe('open');
    expect(after.updatedAt).toBe(ticket.updatedAt);
    expect(after.statusHistory).toEqual(ticket.statusHistory);
  });

  it('Agent Assignee can record open → in_progress', async () => {
    const { accessToken, userId } = await login(app, AGENT_EMAIL);
    const ticket = await ticketByTitle(
      app,
      accessToken,
      'Stale open: billing portal timeout',
    );
    expect(ticket.status).toBe('open');
    const historyLength = ticket.statusHistory.length;

    const response = await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'in_progress' })
      .expect(200);

    expect(response.body.status).toBe('in_progress');
    expect(response.body.resolvedAt).toBeNull();
    expect(Date.parse(response.body.updatedAt)).toBeGreaterThan(
      Date.parse(ticket.updatedAt),
    );
    expect(response.body.statusHistory).toHaveLength(historyLength + 1);
    expectLatestTransition(response.body, {
      from: 'open',
      to: 'in_progress',
      changedBy: { id: userId, displayName: 'Alex Agent' },
    });
  });

  it('Agent Assignee can record in_progress → resolved and sets resolvedAt', async () => {
    const { accessToken, userId } = await login(app, AGENT_EMAIL);
    const ticket = await ticketByTitle(
      app,
      accessToken,
      'In progress: shipment tracking API',
    );
    expect(ticket.status).toBe('in_progress');
    expect(ticket.resolvedAt).toBeNull();
    const historyLength = ticket.statusHistory.length;

    const response = await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'resolved' })
      .expect(200);

    expect(response.body.status).toBe('resolved');
    expect(response.body.resolvedAt).toEqual(expect.any(String));
    expect(Date.parse(response.body.updatedAt)).toBeGreaterThan(
      Date.parse(ticket.updatedAt),
    );
    expect(response.body.statusHistory).toHaveLength(historyLength + 1);
    expectLatestTransition(response.body, {
      from: 'in_progress',
      to: 'resolved',
      changedBy: { id: userId, displayName: 'Alex Agent' },
    });
  });

  it('Administrator can record open → in_progress on an unassigned Ticket they are not Assignee of', async () => {
    const admin = await login(app, ADMIN_EMAIL);
    const ticket = await ticketByTitle(
      app,
      admin.accessToken,
      'High: warehouse scanner pairing',
    );
    expect(ticket.status).toBe('open');
    const historyLength = ticket.statusHistory.length;

    const response = await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'in_progress' })
      .expect(200);

    expect(response.body.status).toBe('in_progress');
    expect(response.body.assignee).toBeNull();
    expect(response.body.statusHistory).toHaveLength(historyLength + 1);
    expectLatestTransition(response.body, {
      from: 'open',
      to: 'in_progress',
      changedBy: { id: admin.userId, displayName: 'Ada Admin' },
    });
  });

  it('Agent and Supervisor cannot close or reopen even when Assignee; Ticket unchanged', async () => {
    const agent = await login(app, AGENT_EMAIL);
    const supervisor = await login(app, SUPERVISOR_EMAIL);

    await expectPatchForbiddenUnchanged(
      app,
      agent.accessToken,
      'Resolved: gift-card balance mismatch',
      'closed',
      (before, after) => {
        expect(before.status).toBe('resolved');
        expect(after.closedAt).toBeNull();
      },
    );

    await expectPatchForbiddenUnchanged(
      app,
      agent.accessToken,
      'Closed: invoice PDF encoding',
      'open',
      (before, after) => {
        expect(before.status).toBe('closed');
        expect(after.resolvedAt).toBe(before.resolvedAt);
        expect(after.closedAt).toBe(before.closedAt);
      },
    );

    await expectPatchForbiddenUnchanged(
      app,
      supervisor.accessToken,
      'Resolved: SSO redirect loop',
      'closed',
      (before) => expect(before.status).toBe('resolved'),
    );

    await expectPatchForbiddenUnchanged(
      app,
      supervisor.accessToken,
      'Closed (older): dealer SSO onboarding',
      'open',
      (before) => expect(before.status).toBe('closed'),
    );
  });

  it('Agent close or reopen of a Ticket outside List Scope is 404', async () => {
    const agent = await login(app, AGENT_EMAIL);
    const supervisor = await login(app, SUPERVISOR_EMAIL);
    const dealer = await ticketByTitle(
      app,
      supervisor.accessToken,
      'Closed (older): dealer SSO onboarding',
    );

    const patchClose = await request(app.getHttpServer())
      .patch(`/tickets/${dealer.id}`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .send({ status: 'closed' })
      .expect(404);
    const patchReopen = await request(app.getHttpServer())
      .patch(`/tickets/${dealer.id}`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .send({ status: 'open' })
      .expect(404);

    expect(JSON.stringify(patchClose.body)).not.toMatch(/dealer SSO/);
    expect(JSON.stringify(patchReopen.body)).not.toMatch(/dealer SSO/);

    const after = await ticketByTitle(
      app,
      supervisor.accessToken,
      'Closed (older): dealer SSO onboarding',
    );
    expect(after.status).toBe('closed');
    expect(after.updatedAt).toBe(dealer.updatedAt);
  });

  it('Administrator can close a resolved Ticket they are not Assignee of', async () => {
    const admin = await login(app, ADMIN_EMAIL);
    const ticket = await ticketByTitle(
      app,
      admin.accessToken,
      'Resolved: gift-card balance mismatch',
    );
    expect(ticket.status).toBe('resolved');
    expect(ticket.closedAt).toBeNull();
    expect(ticket.assignee).toEqual({
      id: expect.any(String),
      displayName: 'Alex Agent',
    });
    const historyLength = ticket.statusHistory.length;

    const response = await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'closed' })
      .expect(200);

    expect(response.body.status).toBe('closed');
    expect(response.body.closedAt).toEqual(expect.any(String));
    expect(response.body.resolvedAt).toEqual(expect.any(String));
    expect(response.body.assignee).toEqual(ticket.assignee);
    expect(response.body.statusHistory).toHaveLength(historyLength + 1);
    expectLatestTransition(response.body, {
      from: 'resolved',
      to: 'closed',
      changedBy: { id: admin.userId, displayName: 'Ada Admin' },
    });
  });

  it('Administrator can reopen a closed Ticket without changing Assignee and clears timestamps', async () => {
    const admin = await login(app, ADMIN_EMAIL);
    const ticket = await ticketByTitle(
      app,
      admin.accessToken,
      'Closed: invoice PDF encoding',
    );
    expect(ticket.status).toBe('closed');
    expect(ticket.closedAt).toEqual(expect.any(String));
    expect(ticket.resolvedAt).toEqual(expect.any(String));
    const priorHistory = ticket.statusHistory;
    const assignee = ticket.assignee;

    const response = await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'open' })
      .expect(200);

    expect(response.body.status).toBe('open');
    expect(response.body.resolvedAt).toBeNull();
    expect(response.body.closedAt).toBeNull();
    expect(response.body.assignee).toEqual({
      id: assignee?.id,
      displayName: 'Alex Agent',
    });
    expect(response.body.statusHistory).toHaveLength(priorHistory.length + 1);
    expect(response.body.statusHistory.slice(0, priorHistory.length)).toEqual(
      priorHistory,
    );
    expectLatestTransition(response.body, {
      from: 'closed',
      to: 'open',
      changedBy: { id: admin.userId, displayName: 'Ada Admin' },
    });
  });
});

describe('Tickets create Comment (e2e)', () => {
  it('Agent POST Comment on an unassigned Ticket they created succeeds as public when visibility is omitted', async () => {
    const { accessToken, userId } = await login(app, AGENT_EMAIL);
    const ticket = await ticketByTitle(
      app,
      accessToken,
      'High: patient portal MFA reset',
    );
    expect(ticket.assignee).toBeNull();
    const priorComments = ticket.comments;
    const priorUpdatedAt = ticket.updatedAt;

    const response = await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ body: 'Client confirmed MFA emails still missing.' })
      .expect(201);

    expect(response.body.comments).toHaveLength(priorComments.length + 1);
    expect(response.body.comments.slice(0, priorComments.length)).toEqual(
      priorComments,
    );
    expect(response.body.comments[response.body.comments.length - 1]).toEqual({
      id: expect.any(String),
      body: 'Client confirmed MFA emails still missing.',
      visibility: 'public',
      createdAt: expect.any(String),
      author: { id: userId, displayName: 'Alex Agent' },
    });
    expect(Date.parse(response.body.updatedAt)).toBeGreaterThan(
      Date.parse(priorUpdatedAt),
    );
  });

  it('Agent POST Comment with visibility public appends in oldest-first order and advances updatedAt', async () => {
    const { accessToken, userId } = await login(app, AGENT_EMAIL);
    const ticket = await ticketByTitle(
      app,
      accessToken,
      'High: appointment sync lag',
    );
    expect(ticket.comments).toEqual([]);
    const priorUpdatedAt = ticket.updatedAt;

    const response = await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        body: 'Asked Client for sync window logs.',
        visibility: 'public',
      })
      .expect(201);

    expect(response.body.comments).toEqual([
      {
        id: expect.any(String),
        body: 'Asked Client for sync window logs.',
        visibility: 'public',
        createdAt: expect.any(String),
        author: { id: userId, displayName: 'Alex Agent' },
      },
    ]);
    expect(Date.parse(response.body.updatedAt)).toBeGreaterThan(
      Date.parse(priorUpdatedAt),
    );
  });

  it('Agent POST Comment outside List Scope or unknown id matches GET Ticket non-existence', async () => {
    const agent = await login(app, AGENT_EMAIL);
    const supervisor = await login(app, SUPERVISOR_EMAIL);
    const warehouse = await ticketByTitle(
      app,
      supervisor.accessToken,
      'High: warehouse scanner pairing',
    );

    const unknownId = '00000000-0000-4000-8000-000000000099';
    const getUnknown = await request(app.getHttpServer())
      .get(`/tickets/${unknownId}`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .expect(404);
    const postUnknown = await request(app.getHttpServer())
      .post(`/tickets/${unknownId}/comments`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .send({ body: 'Should not land.' })
      .expect(404);
    const postHidden = await request(app.getHttpServer())
      .post(`/tickets/${warehouse.id}/comments`)
      .set('Authorization', `Bearer ${agent.accessToken}`)
      .send({ body: 'Should not land.' })
      .expect(404);

    expect(postUnknown.body).toEqual(getUnknown.body);
    expect(postHidden.body).toEqual(getUnknown.body);
    expect(JSON.stringify(postHidden.body)).not.toMatch(/warehouse scanner/);

    const after = await ticketByTitle(
      app,
      supervisor.accessToken,
      'High: warehouse scanner pairing',
    );
    expect(after.comments).toEqual(warehouse.comments);
    expect(after.updatedAt).toBe(warehouse.updatedAt);
  });

  it('POST Comment with empty body returns HTTP 400 without writing', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const ticket = await ticketByTitle(
      app,
      accessToken,
      'Resolved: fax gateway retry storm',
    );
    const prior = ticket;

    const empty = await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ body: '   ' })
      .expect(400);
    const missing = await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(400);

    for (const response of [empty, missing]) {
      expect(response.body).not.toHaveProperty('stack');
      expect(JSON.stringify(response.body)).not.toMatch(/TicketsService/);
    }

    const after = await ticketByTitle(
      app,
      accessToken,
      'Resolved: fax gateway retry storm',
    );
    expect(after.comments).toEqual(prior.comments);
    expect(after.updatedAt).toBe(prior.updatedAt);
  });

  it('POST /tickets/:id/comments without a token returns the same opaque 401 as GET /auth/me', async () => {
    const me = await request(app.getHttpServer()).get('/auth/me').expect(401);
    const created = await request(app.getHttpServer())
      .post('/tickets/00000000-0000-4000-8000-000000000001/comments')
      .send({ body: 'Unauthenticated.' })
      .expect(401);

    expect(created.body).toEqual(me.body);
  });

  it('Agent POST internal Comment on a consultable Ticket is Authorization failure without writing', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const before = await ticketByTitle(
      app,
      accessToken,
      'High: patient portal MFA reset',
    );

    const denied = await request(app.getHttpServer())
      .post(`/tickets/${before.id}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        body: 'Agent must not post internal notes.',
        visibility: 'internal',
      })
      .expect(403);

    expect(denied.body).not.toHaveProperty('stack');
    expect(JSON.stringify(denied.body)).not.toMatch(/TicketsService/);

    const after = await ticketByTitle(
      app,
      accessToken,
      'High: patient portal MFA reset',
    );
    expect(after.id).toBe(before.id);
    expect(after.comments).toEqual(before.comments);
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  it('Supervisor POST internal Comment on an in-scope Ticket succeeds', async () => {
    const { accessToken, userId } = await login(app, SUPERVISOR_EMAIL);
    const ticket = await ticketByTitle(
      app,
      accessToken,
      'Low: documentation typo',
    );
    const priorComments = ticket.comments;
    const priorUpdatedAt = ticket.updatedAt;

    const response = await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        body: 'Internal: check docs PR before closing.',
        visibility: 'internal',
      })
      .expect(201);

    expect(response.body.comments).toHaveLength(priorComments.length + 1);
    expect(response.body.comments.slice(0, priorComments.length)).toEqual(
      priorComments,
    );
    expect(response.body.comments[response.body.comments.length - 1]).toEqual({
      id: expect.any(String),
      body: 'Internal: check docs PR before closing.',
      visibility: 'internal',
      createdAt: expect.any(String),
      author: { id: userId, displayName: 'Sam Supervisor' },
    });
    expect(Date.parse(response.body.updatedAt)).toBeGreaterThan(
      Date.parse(priorUpdatedAt),
    );
  });

  it('Administrator POST internal Comment on an in-scope Ticket succeeds', async () => {
    const { accessToken, userId } = await login(app, ADMIN_EMAIL);
    const ticket = await ticketByTitle(
      app,
      accessToken,
      'High: warehouse scanner pairing',
    );
    const priorComments = ticket.comments;
    const priorUpdatedAt = ticket.updatedAt;

    const response = await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        body: 'Internal: warehouse firmware rollback plan.',
        visibility: 'internal',
      })
      .expect(201);

    expect(response.body.comments).toHaveLength(priorComments.length + 1);
    expect(response.body.comments.slice(0, priorComments.length)).toEqual(
      priorComments,
    );
    expect(response.body.comments[response.body.comments.length - 1]).toEqual({
      id: expect.any(String),
      body: 'Internal: warehouse firmware rollback plan.',
      visibility: 'internal',
      createdAt: expect.any(String),
      author: { id: userId, displayName: 'Ada Admin' },
    });
    expect(Date.parse(response.body.updatedAt)).toBeGreaterThan(
      Date.parse(priorUpdatedAt),
    );
  });

  it('Supervisor and Administrator can still create public Comments', async () => {
    const supervisor = await login(app, SUPERVISOR_EMAIL);
    const admin = await login(app, ADMIN_EMAIL);
    const supervisorTicket = await ticketByTitle(
      app,
      supervisor.accessToken,
      'Critical: telematics feed down',
    );
    const adminTicket = await ticketByTitle(
      app,
      admin.accessToken,
      'Critical: checkout outage',
    );

    const supervisorResponse = await request(app.getHttpServer())
      .post(`/tickets/${supervisorTicket.id}/comments`)
      .set('Authorization', `Bearer ${supervisor.accessToken}`)
      .send({
        body: 'Supervisor public update for telematics Client.',
        visibility: 'public',
      })
      .expect(201);
    expect(
      supervisorResponse.body.comments[
        supervisorResponse.body.comments.length - 1
      ],
    ).toEqual({
      id: expect.any(String),
      body: 'Supervisor public update for telematics Client.',
      visibility: 'public',
      createdAt: expect.any(String),
      author: { id: supervisor.userId, displayName: 'Sam Supervisor' },
    });

    const adminResponse = await request(app.getHttpServer())
      .post(`/tickets/${adminTicket.id}/comments`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ body: 'Administrator public update for checkout outage.' })
      .expect(201);
    expect(
      adminResponse.body.comments[adminResponse.body.comments.length - 1],
    ).toEqual({
      id: expect.any(String),
      body: 'Administrator public update for checkout outage.',
      visibility: 'public',
      createdAt: expect.any(String),
      author: { id: admin.userId, displayName: 'Ada Admin' },
    });
  });
});
