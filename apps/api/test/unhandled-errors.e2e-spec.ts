import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TicketsService } from '../src/tickets/tickets.service';
import { AGENT_EMAIL } from './demo-credentials';
import { login } from './login';

describe('Unhandled errors (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TicketsService)
      .useValue({
        list: async () => {
          throw new Error('secret P2002 TicketsService');
        },
      })
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
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
  });
});
