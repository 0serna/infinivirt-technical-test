import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TicketsService } from '../src/tickets/tickets.service';
import { createTestApp } from './create-test-app';
import { AGENT_EMAIL } from './demo-credentials';
import { login } from './login';

describe('Unhandled errors (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(TicketsService).useValue({
        list: async () => {
          throw new Error('secret P2002 TicketsService');
        },
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('unexpected Error returns HTTP 500 without internals', async () => {
    const { accessToken } = await login(app, AGENT_EMAIL);
    const response = await request(app.getHttpServer())
      .get('/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(500);

    expect(response.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
    expect(response.body).not.toHaveProperty('stack');
    expect(JSON.stringify(response.body)).not.toMatch(
      /secret|P2002|TicketsService/i,
    );
  });
});
