// click-events.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Click, ClickDocument } from '../analytics/schemas/click.schema';
import * as crypto from 'crypto';
import { UAParser } from 'ua-parser-js';
import * as geoip from 'geoip-lite';
import { Link, LinkDocument } from 'src/links/schemas/link.schema';

@Processor('click-events')
export class ClickEventsProcessor extends WorkerHost {
  constructor(@InjectModel(Click.name) private clickModel: Model<ClickDocument>,@InjectModel(Link.name) private linkModel: Model<LinkDocument>) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { short_code, ip, referrer, user_agent, clicked_at } = job.data;

    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const ua = new UAParser(user_agent).getResult();
    const geo = geoip.lookup(ip);

    await Promise.all([
      this.clickModel.create({
        short_code,
        ip_hash: ipHash,
        referrer: referrer || 'direct',
        device: ua.device.type || 'desktop',
        browser: ua.browser.name || 'unknown',
        country: geo?.country || 'unknown',
      }),
      this.linkModel.updateOne({ short_code }, { $inc: { clicks: 1 } }), // moved here
    ]);
  }
}