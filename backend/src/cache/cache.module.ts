import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

@Global() // ← add this
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
