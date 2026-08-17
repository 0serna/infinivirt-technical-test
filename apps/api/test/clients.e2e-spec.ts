import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { ClientCatalogRow } from '@support-ticketing/shared';
import request from 'supertest';
import { createTestApp } from './create-test-app';
import { ADMIN_EMAIL, AGENT_EMAIL, SUPERVISOR_EMAIL } from './demo-credentials';
import { login } from './login';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app?.close();
});

describe('Clients catalog (e2e)', () => {
  it('GET /clients without a token returns the same opaque 401 as GET /auth/me', async () => {
    const me = await request(app.getHttpServer()).get('/auth/me').expect(401);
    const clients = await request(app.getHttpServer())
      .get('/clients')
      .expect(401);

    expect(clients.body).toEqual(me.body);
  });

  it.each([AGENT_EMAIL, SUPERVISOR_EMAIL, ADMIN_EMAIL])(
    'authenticated %s receives the full Client catalog as { id, name }[] sorted by name',
    async (email) => {
      const { accessToken } = await login(app, email);
      const response = await request(app.getHttpServer())
        .get('/clients')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      for (const row of response.body as ClientCatalogRow[]) {
        expect(row).toEqual({
          id: expect.any(String),
          name: expect.any(String),
          deletedAt: null,
        });
        expect(Object.keys(row).sort()).toEqual(['deletedAt', 'id', 'name']);
      }

      const names = (response.body as ClientCatalogRow[]).map(
        (row) => row.name,
      );
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      expect(names).toEqual(
        expect.arrayContaining([
          'Acme Logistics',
          'Contoso Health',
          'Fabrikam Motors',
          'Globex Energy',
          'Initech Soft',
          'Northwind Retail',
        ]),
      );
    },
  );
});

describe('Clients admin create (e2e)', () => {
  it('Administrator POST /clients creates a Client that appears in GET /clients', async () => {
    const name = `Admin Co ${Date.now()}`;
    const { accessToken } = await login(app, ADMIN_EMAIL);

    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name })
      .expect(201);

    expect(created.body).toEqual({
      id: expect.any(String),
      name,
      deletedAt: null,
    });
    expect(Object.keys(created.body).sort()).toEqual([
      'deletedAt',
      'id',
      'name',
    ]);

    const catalog = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      (catalog.body as ClientCatalogRow[]).some((row) => row.name === name),
    ).toBe(true);
  });

  it.each([AGENT_EMAIL, SUPERVISOR_EMAIL])(
    'authenticated %s POST /clients returns HTTP 403',
    async (email) => {
      const { accessToken } = await login(app, email);
      const response = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Forbidden Co ${Date.now()}` })
        .expect(403);

      expect(response.body).not.toHaveProperty('stack');
      expect(response.status).toBe(403);
    },
  );

  it('Administrator POST /clients with a blank name returns HTTP 400', async () => {
    const { accessToken } = await login(app, ADMIN_EMAIL);
    await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '   ' })
      .expect(400);
  });

  it('Administrator POST /clients with a duplicate name returns HTTP 409', async () => {
    const name = `Unique Co ${Date.now()}`;
    const { accessToken } = await login(app, ADMIN_EMAIL);

    await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name })
      .expect(201);

    await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name })
      .expect(409);
  });

  it('Agent GET /clients includes a Client created by Administrator', async () => {
    const name = `Ops Catalog ${Date.now()}`;
    const { accessToken: adminToken } = await login(app, ADMIN_EMAIL);
    await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name })
      .expect(201);

    const { accessToken: agentToken } = await login(app, AGENT_EMAIL);
    const catalog = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(
      (catalog.body as ClientCatalogRow[]).some((row) => row.name === name),
    ).toBe(true);
  });
});

describe('Clients admin rename, soft-delete & restore (e2e)', () => {
  it('Administrator renames an active Client; clash with active or soft-deleted name returns 409', async () => {
    const { accessToken } = await login(app, ADMIN_EMAIL);
    const stamp = Date.now();
    const original = `Rename Me ${stamp}`;
    const takenActive = `Taken Active ${stamp}`;
    const takenDeleted = `Taken Deleted ${stamp}`;

    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: original })
      .expect(201);

    await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: takenActive })
      .expect(201);

    const softDeleted = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: takenDeleted })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/clients/${softDeleted.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const renamed = await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `Renamed ${stamp}` })
      .expect(200);

    expect(renamed.body).toEqual({
      id: created.body.id,
      name: `Renamed ${stamp}`,
      deletedAt: null,
    });

    await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: takenActive })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: takenDeleted })
      .expect(409);
  });

  it('Administrator soft-deletes a Client with Tickets; it leaves default catalog; Tickets still show the name', async () => {
    const { accessToken: adminToken } = await login(app, ADMIN_EMAIL);
    const { accessToken: agentToken } = await login(app, AGENT_EMAIL);
    const name = `Soft Delete Ticket Co ${Date.now()}`;

    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        clientId: client.body.id,
        title: `Ticket for soft-deleted client ${Date.now()}`,
        description: 'Should still show Client name after soft-delete.',
      })
      .expect(201);

    const softDeleted = await request(app.getHttpServer())
      .delete(`/clients/${client.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(softDeleted.body).toEqual({
      id: client.body.id,
      name,
      deletedAt: expect.any(String),
    });
    expect(Date.parse(softDeleted.body.deletedAt as string)).not.toBeNaN();

    const catalog = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (catalog.body as ClientCatalogRow[]).some(
        (row) => row.id === client.body.id,
      ),
    ).toBe(false);

    const detail = await request(app.getHttpServer())
      .get(`/tickets/${ticket.body.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    expect(detail.body.client).toEqual({ id: client.body.id, name });

    const list = await request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    const listed = (
      list.body.tickets as Array<{
        id: string;
        client: { id: string; name: string };
      }>
    ).find((row) => row.id === ticket.body.id);
    expect(listed?.client).toEqual({ id: client.body.id, name });
  });

  it('Administrator restores a soft-deleted Client; it returns to the create catalog', async () => {
    const { accessToken } = await login(app, ADMIN_EMAIL);
    const name = `Restore Co ${Date.now()}`;

    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/clients/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const restored = await request(app.getHttpServer())
      .post(`/clients/${created.body.id}/restore`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(restored.body).toEqual({
      id: created.body.id,
      name,
      deletedAt: null,
    });

    const catalog = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(
      (catalog.body as ClientCatalogRow[]).some(
        (row) => row.id === created.body.id,
      ),
    ).toBe(true);
  });

  it('Administrator includeDeleted lists soft-deleted Clients; non-Admin ignore the flag', async () => {
    const { accessToken: adminToken } = await login(app, ADMIN_EMAIL);
    const name = `Include Deleted Co ${Date.now()}`;

    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/clients/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const adminWithDeleted = await request(app.getHttpServer())
      .get('/clients')
      .query({ includeDeleted: 'true' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const adminRow = (adminWithDeleted.body as ClientCatalogRow[]).find(
      (row) => row.id === created.body.id,
    );
    expect(adminRow).toEqual({
      id: created.body.id,
      name,
      deletedAt: expect.any(String),
    });

    const { accessToken: agentToken } = await login(app, AGENT_EMAIL);
    const agentWithFlag = await request(app.getHttpServer())
      .get('/clients')
      .query({ includeDeleted: 'true' })
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    expect(
      (agentWithFlag.body as ClientCatalogRow[]).some(
        (row) => row.id === created.body.id,
      ),
    ).toBe(false);

    const { accessToken: supervisorToken } = await login(app, SUPERVISOR_EMAIL);
    const supervisorWithFlag = await request(app.getHttpServer())
      .get('/clients')
      .query({ includeDeleted: 'true' })
      .set('Authorization', `Bearer ${supervisorToken}`)
      .expect(200);
    expect(
      (supervisorWithFlag.body as ClientCatalogRow[]).some(
        (row) => row.id === created.body.id,
      ),
    ).toBe(false);
  });

  it('Update/rename of a soft-deleted Client is rejected until restore', async () => {
    const { accessToken } = await login(app, ADMIN_EMAIL);
    const name = `Frozen Soft ${Date.now()}`;

    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/clients/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `Should Fail ${Date.now()}` })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/clients/${created.body.id}/restore`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const renamed = await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `After Restore ${Date.now()}` })
      .expect(200);
    expect(renamed.body.deletedAt).toBeNull();
  });

  it.each([AGENT_EMAIL, SUPERVISOR_EMAIL])(
    'authenticated %s Client mutations return HTTP 403',
    async (email) => {
      const { accessToken: adminToken } = await login(app, ADMIN_EMAIL);
      const created = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Mutation Target ${Date.now()}-${email}` })
        .expect(201);

      const { accessToken } = await login(app, email);

      await request(app.getHttpServer())
        .patch(`/clients/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Hijack ${Date.now()}` })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/clients/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .post(`/clients/${created.body.id}/restore`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    },
  );
});
