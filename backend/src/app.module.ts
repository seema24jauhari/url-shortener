import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { LoggerModule } from 'nestjs-pino';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './common/redis-throttler.storage';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyMiddleware } from './common/middleware/api-key.middleware';
import 'http';
import { JwtModule } from '@nestjs/jwt';
import { LinksModule } from './links/links.module';
import { CacheModule } from './cache/cache.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TokensModule } from './tokens/tokens.module';
import { PassportModule } from '@nestjs/passport';
import { DashboardModule } from './dashboard/dashboard.module';
import { MailModule } from './mail/mail.module';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';

declare module 'http' {
  interface IncomingMessage {
    correlationId?: string;
  }
}
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: Number(process.env.THROTTLE_TTL_SECONDS ?? 60) * 1000, limit: 20 }],
        storage: new RedisThrottlerStorage(
          config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        ),
      }),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: { target: 'pino-pretty' }, // pretty-prints in dev
        customProps: (req) => ({ correlationId: req.correlationId }),
      },
    }),
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
    AuthModule,
    UsersModule,
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
    TokensModule,
    PassportModule,
    DashboardModule,
    MailModule,
  ],
  exports: [JwtModule], // is this here?
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }, AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    consumer.apply(ApiKeyMiddleware).forRoutes('*');
  }
}
