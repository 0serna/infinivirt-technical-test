import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TicketsModule } from './tickets/tickets.module';

@Module({
  imports: [PrismaModule, AuthModule, TicketsModule, ClientsModule],
  controllers: [HealthController],
})
export class AppModule {}
