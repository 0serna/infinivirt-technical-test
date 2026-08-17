import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './create-test-app';
import {
  ADMIN_EMAIL,
  AGENT_EMAIL,
  DEMO_PASSWORD,
  SUPERVISOR_EMAIL,
} from './demo-credentials';

async function login(
  app: INestApplication,
  email: string,
): Promise<{ accessToken: string }> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: DEMO_PASSWORD })
    .expect(200);
  return { accessToken: response.body.accessToken as string };
}

type CatalogRow = { id: string; name: string };

function catalogNames(body: unknown): string[] {
  return (body as CatalogRow[]).map((row) => row.name);
}

let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);
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
      for (const row of response.body as CatalogRow[]) {
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

  it('catalog includes Clients outside Agent List Scope filterOptions.clients', async () => {
    const orphanName = `Catalog-only Client ${Date.now()}`;
    const orphan = await prisma.client.create({
      data: { name: orphanName },
    });

    try {
      const { accessToken } = await login(app, AGENT_EMAIL);

      const catalog = await request(app.getHttpServer())
        .get('/clients')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const list = await request(app.getHttpServer())
        .get('/tickets')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const catalogIds = new Set(
        (catalog.body as CatalogRow[]).map((row) => row.id),
      );
      const filterClientIds = new Set(
        (
          list.body.filterOptions.clients as Array<{ id: string; name: string }>
        ).map((row) => row.id),
      );

      expect(catalogIds.has(orphan.id)).toBe(true);
      expect(filterClientIds.has(orphan.id)).toBe(false);
      expect(catalogIds.size).toBeGreaterThan(filterClientIds.size);
      expect([...catalogIds].sort()).not.toEqual([...filterClientIds].sort());
    } finally {
      await prisma.client.delete({ where: { id: orphan.id } });
    }
  });
});
