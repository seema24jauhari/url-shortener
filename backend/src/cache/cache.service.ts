import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class CacheService implements OnModuleInit {
  private client!: Redis;
  constructor(private config: ConfigService) {}

  onModuleInit() {
    const redisUri =   this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.client = new Redis(redisUri);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  // Call on logout — blacklist instantly
  async blacklistToken(token: string, ttlSeconds: number) {
    await this.client.set(`bl:${this.hash(token)}`, '1', 'EX', ttlSeconds);
  }

  // Call before trusting any refresh/access token
  async isBlacklisted(token: string): Promise<boolean> {
    const result = await this.client.get(`bl:${this.hash(token)}`);
    return result !== null;
  }

  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
