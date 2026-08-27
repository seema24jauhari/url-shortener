import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsService } from './analytics.service';
import { Click, ClickSchema } from './schemas/click.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Click.name, schema: ClickSchema }])],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}