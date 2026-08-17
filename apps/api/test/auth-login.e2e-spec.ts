import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';
import { AGENT_EMAIL, DEMO_PASSWORD } from './demo-credentials';

function decodeJwtPayload(token: string): {
  sub?: string;
  exp?: number;
  iat?: number;
} {
  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('Token has no payload segment');
  }
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    sub?: string;
    exp?: number;
    iat?: number;
  };
}

describe('Auth login (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login with seeded credentials returns accessToken and public user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: AGENT_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    expect(response.body).toEqual({
      accessToken: expect.any(String),
      user: {
        id: expect.any(String),
        email: AGENT_EMAIL,
        displayName: 'Alex Turing',
        role: 'agent',
      },
    });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body.user).not.toHaveProperty('password');

    const payload = decodeJwtPayload(response.body.accessToken as string);
    expect(payload.sub).toBe(response.body.user.id);
    expect(payload.exp).toBeDefined();
    expect(payload.iat).toBeDefined();
    const lifetimeSeconds = (payload.exp as number) - (payload.iat as number);
    expect(lifetimeSeconds).toBe(8 * 60 * 60);
  });

  it('POST /auth/login with unknown email or wrong password returns the same opaque 401', async () => {
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: DEMO_PASSWORD })
      .expect(401);

    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: AGENT_EMAIL, password: 'WrongPassword!' })
      .expect(401);

    const missingPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: AGENT_EMAIL })
      .expect(401);

    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(unknownEmail.body).toEqual(missingPassword.body);
    expect(unknownEmail.body).not.toMatchObject({
      message: expect.stringMatching(/user|email|password|found|invalid/i),
    });
  });
});
