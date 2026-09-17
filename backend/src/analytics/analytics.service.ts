import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Click, ClickDocument } from './schemas/click.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Click.name) private clickModel: Model<ClickDocument>,
  ) {}

  async getClickTrend(shortCode: string) {
  const now = new Date();

  // Current date in IST: YYYY-MM-DD
  const todayIST = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  }).format(now);

  // Start of today in IST, converted to UTC
  const todayStart = new Date(`${todayIST}T00:00:00+05:30`);

  // Start of 7-day period
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

  const results = await this.clickModel.aggregate([
    {
      $match: {
        short_code: shortCode,
        clicked_at: {
          $gte: sevenDaysAgo,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$clicked_at',
            timezone: 'Asia/Kolkata',
          },
        },
        clicks: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  console.log('sevenDaysAgo:', sevenDaysAgo);
  console.log('results:', results);
  const trend:[{'day': String, 'clicks': any}] = [{'day': "", 'clicks': 0}]

  for (let i = 0; i < 7; i++) {
    const date = new Date(sevenDaysAgo);
    date.setUTCDate(date.getUTCDate() + i);

    // Convert UTC date to IST date for comparison
    const dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(date);

    const match = results.find((r) => r._id === dateKey);

    // Get weekday in IST
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
    }).format(date);

    trend.push({
      day: weekday,
      clicks: match?.clicks ?? 0,
    });
  }

  return trend;
}

  async getCountryBreakdown(shortCode: string ) {
    return this.clickModel.aggregate([
      { $match: { short_code: shortCode} },
      { $group: { _id: '$country', clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, country: '$_id', clicks: 1 } },
    ]);
  }

  async getReferrerBreakdown(shortCode: string) {
    const raw = await this.clickModel.aggregate([
      { $match: { short_code: shortCode} },
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
      { $match: { short_code: shortCode} },
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
