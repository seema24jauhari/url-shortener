import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { UAParser } from 'ua-parser-js';
import * as geoip from 'geoip-lite';
import { Click, ClickDocument } from './schemas/click.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Click.name) private clickModel: Model<ClickDocument>,
  ) {}

  async getClickTrend(shortCode: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // last 7 days including today
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const results = await this.clickModel.aggregate([
      {
        $match: {
          short_code: shortCode,
          clicked_at: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$clicked_at' },
          },
          clicks: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill in missing days with 0 clicks (so the chart doesn't skip days with no activity)
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const trend: { day: string; clicks: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getUTCDate() + i);
      const dateKey = date.toISOString().slice(0, 10); // 'YYYY-MM-DD'
      const match = results.find((r) => r._id === dateKey);

      trend.push({
        day: dayLabels[date.getUTCDay()],
        clicks: match ? match.clicks : 0,
      });
    }

    return trend;
  }

  async getCountryBreakdown(shortCode: string) {
    return this.clickModel.aggregate([
      { $match: { short_code: shortCode } },
      { $group: { _id: '$country', clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, country: '$_id', clicks: 1 } },
    ]);
  }

  async getReferrerBreakdown(shortCode: string) {
    const raw = await this.clickModel.aggregate([
      { $match: { short_code: shortCode } },
      { $group: { _id: '$referrer', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const total = raw.reduce((sum, r) => sum + r.count, 0);
    if (total === 0) return [];

    return raw.map((r) => ({
      source: r._id === 'direct' ? 'Direct' : r._id,
      pct: Math.round((r.count / total) * 100),
    }));
  }

  async getDeviceBreakdown(shortCode: string) {
    const raw = await this.clickModel.aggregate([
      { $match: { short_code: shortCode } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const total = raw.reduce((sum, r) => sum + r.count, 0);
    if (total === 0) return [];

    return raw.map((r) => ({
      type: r._id.charAt(0).toUpperCase() + r._id.slice(1), // "desktop" → "Desktop"
      pct: Math.round((r.count / total) * 100),
    }));
  }
}
