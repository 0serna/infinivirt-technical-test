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
        });
        expect(Object.keys(row).sort()).toEqual(['id', 'name']);
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
    });
    expect(Object.keys(created.body).sort()).toEqual(['id', 'name']);

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
