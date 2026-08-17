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

describe('Users admin update & password reset (e2e)', () => {
  it('Administrator PATCH /users/:id updates displayName and/or role; email stays immutable', async () => {
    const stamp = Date.now();
    const email = `update.me.${stamp}@example.com`;
    const { accessToken } = await login(app, ADMIN_EMAIL);

    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email,
        displayName: `Before Update ${stamp}`,
        role: 'agent',
        password: 'InitialPass123!',
      })
      .expect(201);

    const renamed = await request(app.getHttpServer())
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ displayName: `After Update ${stamp}` })
      .expect(200);

    expect(renamed.body).toEqual({
      id: created.body.id,
      email,
      displayName: `After Update ${stamp}`,
      role: 'agent',
    });
    expect(renamed.body).not.toHaveProperty('passwordHash');

    const promoted = await request(app.getHttpServer())
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ role: 'supervisor' })
      .expect(200);

    expect(promoted.body).toEqual({
      id: created.body.id,
      email,
      displayName: `After Update ${stamp}`,
      role: 'supervisor',
    });

    await request(app.getHttpServer())
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName: `Both Fields ${stamp}`,
        role: 'agent',
        email: `changed.${stamp}@example.com`,
      })
      .expect(400);

    const catalog = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const row = (catalog.body as UserCatalogRow[]).find(
      (user) => user.id === created.body.id,
    );
    expect(row).toEqual({
      id: created.body.id,
      email,
      displayName: `After Update ${stamp}`,
      role: 'supervisor',
    });
  });

  it('Administrator resets password; User can log in with the new password', async () => {
    const stamp = Date.now();
    const email = `reset.pass.${stamp}@example.com`;
    const oldPassword = `OldPass${stamp}!`;
    const newPassword = `NewPass${stamp}!`;
    const { accessToken } = await login(app, ADMIN_EMAIL);

    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email,
        displayName: `Reset Me ${stamp}`,
        role: 'agent',
        password: oldPassword,
      })
      .expect(201);

    const reset = await request(app.getHttpServer())
      .patch(`/users/${created.body.id}/password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: newPassword })
      .expect(200);

    expect(reset.body).toEqual({
      id: created.body.id,
      email,
      displayName: `Reset Me ${stamp}`,
      role: 'agent',
    });
    expect(reset.body).not.toHaveProperty('passwordHash');

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: oldPassword })
      .expect(401);

    const loggedIn = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: newPassword })
      .expect(200);

    expect(loggedIn.body.user).toEqual({
      id: created.body.id,
      email,
      displayName: `Reset Me ${stamp}`,
      role: 'agent',
    });
    expect(loggedIn.body.user).not.toHaveProperty('passwordHash');
  });

  it('Administrator demoting the last Administrator returns HTTP 409', async () => {
    const { accessToken } = await login(app, ADMIN_EMAIL);
    const catalog = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const admins = (catalog.body as UserCatalogRow[]).filter(
      (user) => user.role === 'admin',
    );
    expect(admins.length).toBeGreaterThanOrEqual(1);

    // Ensure only one admin exists for the demote rejection (create extras as agents).
    // Seed Ada is admin; demote any other admins created by earlier tests first.
    for (const admin of admins) {
      if (admin.email === ADMIN_EMAIL) {
        continue;
      }
      await request(app.getHttpServer())
        .patch(`/users/${admin.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ role: 'agent' })
        .expect(200);
    }

    const soleAdmin = admins.find((user) => user.email === ADMIN_EMAIL);
    expect(soleAdmin).toBeDefined();
    if (!soleAdmin) {
      throw new Error('expected seed Administrator in catalog');
    }

    await request(app.getHttpServer())
      .patch(`/users/${soleAdmin.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ role: 'supervisor' })
      .expect(409);

    const stamp = Date.now();
    const second = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: `second.admin.${stamp}@example.com`,
        displayName: `Second Admin ${stamp}`,
        role: 'admin',
        password: 'SecondAdminPass123!',
      })
      .expect(201);

    const demoted = await request(app.getHttpServer())
      .patch(`/users/${second.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ role: 'agent' })
      .expect(200);

    expect(demoted.body.role).toBe('agent');
    expect(demoted.body).not.toHaveProperty('passwordHash');
  });

  it.each([AGENT_EMAIL, SUPERVISOR_EMAIL])(
    'authenticated %s PATCH /users/:id and password reset return HTTP 403',
    async (actorEmail) => {
      const { accessToken: adminToken } = await login(app, ADMIN_EMAIL);
      const stamp = Date.now();
      const created = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `forbid.update.${stamp}.${actorEmail.split('@')[0]}@example.com`,
          displayName: `Forbid Update ${stamp}`,
          role: 'agent',
          password: 'ForbidPass123!',
        })
        .expect(201);

      const { accessToken } = await login(app, actorEmail);

      const update = await request(app.getHttpServer())
        .patch(`/users/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ displayName: 'Should Not Apply' })
        .expect(403);
      expect(update.body).not.toHaveProperty('stack');

      const reset = await request(app.getHttpServer())
        .patch(`/users/${created.body.id}/password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'HackedPass123!' })
        .expect(403);
      expect(reset.body).not.toHaveProperty('stack');
    },
  );
});
