import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DEMO_PASSWORD } from './demo-credentials';

export async function login(
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
