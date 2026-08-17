import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

export async function createTestApp(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  });
  if (configure) {
    builder = configure(builder);
  }
  const moduleFixture = await builder.compile();
  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}
