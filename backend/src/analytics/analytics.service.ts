import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { UAParser } from 'ua-parser-js';
import * as geoip from 'geoip-lite';
import { Click, ClickDocument } from './schemas/click.schema';

@Injectable()
export class AnalyticsService {
  constructor(@InjectModel(Click.name) private clickModel: Model<ClickDocument>) {}

  // fire-and-forget — never await this from the redirect path
  logClick(shortCode: string, ip: string, userAgent: string, referrer: string) {
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const ua = new UAParser(userAgent).getResult();
    const geo = geoip.lookup(ip);

    this.clickModel
      .create({
        short_code: shortCode,
        ip_hash: ipHash,
        referrer: referrer || 'direct',
        device: ua.device.type || 'desktop',
        browser: ua.browser.name || 'unknown',
        country: geo?.country || 'unknown',
      })
      .catch((err) => console.error('Click logging failed:', err.message));
  }
}