import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
import { ApplicationsModule } from './applications/applications.module';
import { PoliciesModule } from './policies/policies.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    ApplicationsModule,
    PoliciesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
