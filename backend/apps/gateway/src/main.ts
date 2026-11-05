import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GatewayModule } from './gateway.module.js';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
  // The gateway is the only HTTP entry point, so CORS is configured here only.
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`Gateway listening on http://localhost:${port}`, 'Bootstrap');
}
await bootstrap();
