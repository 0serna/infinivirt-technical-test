import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { UserCatalogRow } from '@support-ticketing/shared';
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

describe('Users catalog (e2e)', () => {
  it('GET /users without a token returns the same opaque 401 as GET /auth/me', async () => {
    const me = await request(app.getHttpServer()).get('/auth/me').expect(401);
    const users = await request(app.getHttpServer()).get('/users').expect(401);

    expect(users.body).toEqual(me.body);
  });

  it('Agent GET /users returns HTTP 403', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const response = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(response.body).not.toHaveProperty('stack');
  });

  it.each([SUPERVISOR_EMAIL, ADMIN_EMAIL])(
    'authenticated %s receives the staff User catalog as { id, displayName, role }[] sorted by displayName',
    async (email) => {
      const { accessToken } = await login(app, email);
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3);
      for (const row of response.body as UserCatalogRow[]) {
        expect(row).toEqual({
          id: expect.any(String),
          displayName: expect.any(String),
          role: expect.stringMatching(/^(agent|supervisor|admin)$/),
        });
        expect(Object.keys(row).sort()).toEqual(['displayName', 'id', 'role']);
      }

      const names = (response.body as UserCatalogRow[]).map(
        (row) => row.displayName,
      );
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      expect(names).toEqual(
        expect.arrayContaining(['Ada Admin', 'Alex Agent', 'Sam Supervisor']),
      );
    },
  );
});
