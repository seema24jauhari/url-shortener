import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    _throttlerName: string,
  ) {
    const totalHits = await this.client.incr(key);
    if (totalHits === 1) {
      await this.client.expire(key, Math.ceil(ttl / 1000));
    }
    const timeToExpireSec = await this.client.ttl(key);

    const isBlocked = totalHits > limit; // ← the actual fix
    const timeToBlockExpire = isBlocked ? timeToExpireSec * 1000 : 0;

    return {
      totalHits,
      timeToExpire: timeToExpireSec * 1000,
      isBlocked,
      timeToBlockExpire,
    };
  }
}
