import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { isLoopbackHost } from '../src/config/api-host';

/** DNS-rebinding protection: `main.ts`'s bootstrap() wires this middleware, but integration
 * tests boot AppModule directly (like every other suite here) and never call bootstrap(), so
 * it must be re-registered on the test app. Reuses the same `isLoopbackHost` main.ts calls,
 * so the allowlist itself -- not a hand-copied one -- is under test. */
describe('host-header allowlist (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
      const hostname = (req.headers.host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
      if (isLoopbackHost(hostname)) return next();
      return res.status(403).json({ message: 'requests must be addressed to localhost' });
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a request addressed to a rebound hostname', async () => {
    await request(app.getHttpServer()).get('/api/health').set('Host', 'evil.example.com').expect(403);
  });

  it('allows the default host supertest sends (127.0.0.1:<port>)', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });
});
