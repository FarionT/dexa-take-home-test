import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import type { MicroserviceOptions } from '@nestjs/microservices';
import { getServiceAddress } from '@app/shared';
import { AuthModule } from './auth.module.js';

async function bootstrap() {
  const { host, port } = getServiceAddress('auth');
  // No HTTP server: this service only receives TCP messages from the gateway.
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AuthModule, {
    transport: Transport.TCP,
    options: { host, port },
  });
  await app.listen();
  Logger.log(`Auth service listening on tcp://${host}:${port}`, 'Bootstrap');
}
await bootstrap();
