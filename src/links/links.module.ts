import { Module } from '@nestjs/common';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Link, LinkSchema } from './link.schema';
import { CacheModule } from '../cache/cache.module';

@Module({
  controllers: [LinksController],
  providers: [LinksService],
  imports: [
    MongooseModule.forFeature([{ name: Link.name, schema: LinkSchema }]),
    CacheModule
  ],
})
export class LinksModule {}
