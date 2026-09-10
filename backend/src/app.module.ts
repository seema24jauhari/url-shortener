import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LinksModule } from './links/links.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from './cache/cache.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TokensModule } from './tokens/tokens.module';
import { PassportModule } from '@nestjs/passport';
import { DashboardModule } from './dashboard/dashboard.module';
import { MailModule } from './mail/mail.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('DATABASE_URI'),
        maxPoolSize: 25,        // was 200 — now × 8 workers ≈ 200 total, matching your original intent
        minPoolSize: 5,
        socketTimeoutMS: 10000,
        serverSelectionTimeoutMS: 5000,
        tls: config.get<string>('DB_TLS') === 'true',
        tlsCAFile: config.get<string>('DB_TLS_CA_FILE'),
        retryWrites: false,
      }),
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URI || 'redis://localhost:6379',
      },
    }),
    BullModule.registerQueue({
      name: 'click-events', // queue name
    }),
    LinksModule,
    CacheModule,
    AnalyticsModule,
    AuthModule,
    UsersModule,
    TokensModule,
    PassportModule,
    DashboardModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
