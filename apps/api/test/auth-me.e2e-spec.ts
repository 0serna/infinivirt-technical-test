import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from './create-test-app';
import { AGENT_EMAIL, DEMO_PASSWORD } from './demo-credentials';

describe('Auth me (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /auth/me without a token returns 401', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('GET /auth/me with a valid Bearer token returns the current public user', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: AGENT_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      id: login.body.user.id,
      email: AGENT_EMAIL,
      displayName: 'Alex Turing',
      role: 'agent',
    });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('password');
  });

  it('GET /auth/me with an invalid token returns 401', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer not-a-valid-jwt')
      .expect(401);
  });

  it('GET /auth/me with an expired token returns 401', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: AGENT_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const jwt = new JwtService({
      secret: process.env.JWT_SECRET,
    });
    const expiredToken = await jwt.signAsync(
      { sub: login.body.user.id as string },
      { expiresIn: 0 },
    );

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  it('GET /auth/me returns 401 when the User for sub no longer exists', async () => {
    const jwt = new JwtService({
      secret: process.env.JWT_SECRET,
    });
    const orphanToken = await jwt.signAsync({
      sub: '00000000-0000-4000-8000-000000000099',
    });

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${orphanToken}`)
      .expect(401);
  });
});
