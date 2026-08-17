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
    'authenticated %s receives the staff User catalog as { id, email, displayName, role }[] sorted by displayName',
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
          email: expect.any(String),
          displayName: expect.any(String),
          role: expect.stringMatching(/^(agent|supervisor|admin)$/),
        });
        expect(Object.keys(row).sort()).toEqual([
          'displayName',
          'email',
          'id',
          'role',
        ]);
        expect(row).not.toHaveProperty('passwordHash');
      }

      const names = (response.body as UserCatalogRow[]).map(
        (row) => row.displayName,
      );
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      expect(names).toEqual(
        expect.arrayContaining(['Ada Admin', 'Alex Agent', 'Sam Supervisor']),
      );
      expect(
        (response.body as UserCatalogRow[]).map((row) => row.email),
      ).toEqual(
        expect.arrayContaining([ADMIN_EMAIL, AGENT_EMAIL, SUPERVISOR_EMAIL]),
      );
    },
  );
});

describe('Users admin create (e2e)', () => {
  it('Administrator POST /users creates a User that can log in and appears in GET /users', async () => {
    const stamp = Date.now();
    const email = `new.agent.${stamp}@example.com`;
    const password = `InitialPass${stamp}!`;
    const displayName = `New Agent ${stamp}`;
    const { accessToken } = await login(app, ADMIN_EMAIL);

    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email,
        displayName,
        role: 'agent',
        password,
      })
      .expect(201);

    expect(created.body).toEqual({
      id: expect.any(String),
      email,
      displayName,
      role: 'agent',
    });
    expect(Object.keys(created.body).sort()).toEqual([
      'displayName',
      'email',
      'id',
      'role',
    ]);
    expect(created.body).not.toHaveProperty('passwordHash');

    const catalog = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      (catalog.body as UserCatalogRow[]).some(
        (row) => row.email === email && row.displayName === displayName,
      ),
    ).toBe(true);

    const loggedIn = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(loggedIn.body.user).toEqual({
      id: created.body.id,
      email,
      displayName,
      role: 'agent',
    });
    expect(loggedIn.body.user).not.toHaveProperty('passwordHash');
    expect(typeof loggedIn.body.accessToken).toBe('string');
  });

  it.each([AGENT_EMAIL, SUPERVISOR_EMAIL])(
    'authenticated %s POST /users returns HTTP 403',
    async (email) => {
      const { accessToken } = await login(app, email);
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: `forbidden.${Date.now()}@example.com`,
          displayName: 'Forbidden User',
          role: 'agent',
          password: 'ForbiddenPass123!',
        })
        .expect(403);

      expect(response.body).not.toHaveProperty('stack');
      expect(response.status).toBe(403);
    },
  );

  it('Administrator POST /users with blank fields returns HTTP 400', async () => {
    const { accessToken } = await login(app, ADMIN_EMAIL);
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: '   ',
        displayName: 'Valid Name',
        role: 'agent',
        password: 'ValidPass123!',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: `blank.name.${Date.now()}@example.com`,
        displayName: '   ',
        role: 'agent',
        password: 'ValidPass123!',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: `blank.pass.${Date.now()}@example.com`,
        displayName: 'Valid Name',
        role: 'agent',
        password: '   ',
      })
      .expect(400);
  });

  it('Administrator POST /users with an invalid role returns HTTP 400', async () => {
    const { accessToken } = await login(app, ADMIN_EMAIL);
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: `bad.role.${Date.now()}@example.com`,
        displayName: 'Bad Role',
        role: 'owner',
        password: 'ValidPass123!',
      })
      .expect(400);
  });

  it('Administrator POST /users with a duplicate email returns HTTP 409', async () => {
    const email = `dup.user.${Date.now()}@example.com`;
    const { accessToken } = await login(app, ADMIN_EMAIL);

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email,
        displayName: 'First Dup',
        role: 'agent',
        password: 'ValidPass123!',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email,
        displayName: 'Second Dup',
        role: 'supervisor',
        password: 'OtherPass123!',
      })
      .expect(409);
  });
});
