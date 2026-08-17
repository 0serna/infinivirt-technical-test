import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { ClientCatalogRow } from '@support-ticketing/shared';
import request from 'supertest';
import { createTestApp } from './create-test-app';
import { ADMIN_EMAIL, AGENT_EMAIL, SUPERVISOR_EMAIL } from './demo-credentials';
import { login } from './login';

function catalogNames(body: unknown): string[] {
  return (body as ClientCatalogRow[]).map((row) => row.name);
}

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

      const names = catalogNames(response.body);
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
