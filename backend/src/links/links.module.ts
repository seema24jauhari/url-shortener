import { Module } from '@nestjs/common';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Link, LinkSchema } from './schemas/link.schema';
import { CacheModule } from '../cache/cache.module';
import { AnalyticsModule } from 'src/analytics/analytics.module';
import { BullModule } from '@nestjs/bullmq';
import { ClickEventsProcessor } from 'src/events/click-events.processor';
import { Click, ClickSchema } from 'src/analytics/schemas/click.schema';

@Module({
  controllers: [LinksController],
  providers: [LinksService, ClickEventsProcessor],
  imports: [
    BullModule.registerQueue({ name: 'click-events' }),
    MongooseModule.forFeature([{ name: Link.name, schema: LinkSchema },{ name: Click.name, schema: ClickSchema } ]),
    CacheModule,
    AnalyticsModule
  ],
})
export class LinksModule {}
