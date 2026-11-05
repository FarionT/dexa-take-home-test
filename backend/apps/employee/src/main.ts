import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import type { MicroserviceOptions } from '@nestjs/microservices';
import { getServiceAddress } from '@app/shared';
import { EmployeeModule } from './employee.module.js';

async function bootstrap() {
  const { host, port } = getServiceAddress('employee');
  // No HTTP server: this service only receives TCP messages from the gateway.
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(EmployeeModule, {
    transport: Transport.TCP,
    options: { host, port },
  });
  await app.listen();
  Logger.log(`Employee service listening on tcp://${host}:${port}`, 'Bootstrap');
}
await bootstrap();
