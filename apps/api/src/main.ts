import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SessionsService } from './sessions/sessions.service';

const MAX_JSON_BODY_BYTES = '512kb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const { json } = await import('express');
  app.use(json({ limit: MAX_JSON_BODY_BYTES }));
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' });

  await app.get(SessionsService).markStaleSessionsDisconnected();

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, '127.0.0.1');
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap();
