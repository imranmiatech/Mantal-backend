import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppBootstrapService } from './app.bootstrap';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { PublicModule } from './modules/public/public.module';
import { ResearcherModule } from './modules/researcher/researcher.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PublicModule,
    ResearcherModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppBootstrapService],
})
export class AppModule {}
