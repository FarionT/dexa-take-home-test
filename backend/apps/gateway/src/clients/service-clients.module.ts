import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SERVICE_CLIENTS, SERVICE_KEYS, getServiceAddress } from '@app/shared';

// One TCP client per microservice, injectable by its SERVICE_CLIENTS token.
const clients = ClientsModule.register(
  SERVICE_KEYS.map((key) => ({
    name: SERVICE_CLIENTS[key],
    transport: Transport.TCP,
    options: getServiceAddress(key),
  })),
);

@Module({
  imports: [clients],
  exports: [clients],
})
export class ServiceClientsModule {}
