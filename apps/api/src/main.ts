import 'reflect-metadata';
import path from 'node:path';
import dotenv from 'dotenv';

// `nest start` runs with cwd apps/api, and `node dist/main.js` may run from anywhere --
// load the monorepo-root .env explicitly instead of relying on cwd-relative discovery.
// Never overrides variables already set in the real environment (dotenv default).
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SessionsService } from './sessions/sessions.service';
import { isLoopbackHost, resolveApiHost, resolveCorsOrigins } from './config/api-host';

const MAX_JSON_BODY_BYTES = '512kb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const { json } = await import('express');
  app.use(json({ limit: MAX_JSON_BODY_BYTES }));

  // DNS-rebinding protection: a hostile page can point its own domain at 127.0.0.1 and
  // bypass CORS via same-origin requests. Reject anything not addressed to localhost.
  app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const hostname = (req.headers.host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
    if (isLoopbackHost(hostname)) return next();
    return res.status(403).json({ message: 'requests must be addressed to localhost' });
  });

  app.enableCors({ origin: resolveCorsOrigins() });

  await app.get(SessionsService).markStaleSessionsDisconnected();

  const port = Number(process.env.API_PORT ?? 4000);
  // Local default stays 127.0.0.1 (security); containers set API_HOST=0.0.0.0 so the
  // published port is reachable from the host.
  const host = resolveApiHost();
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://${host}:${port}`);
}

bootstrap();
