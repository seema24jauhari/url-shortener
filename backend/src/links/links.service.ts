import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { nanoid } from 'nanoid';
import { Link, LinkDocument } from './schemas/link.schema';
import { Model, Types } from 'mongoose';
import { CacheService } from 'src/cache/cache.service';
import { AnalyticsService } from 'src/analytics/analytics.service';

export interface LinkType {
  short_code: string;
  long_url: string;
}

@Injectable()
export class LinksService {
  constructor(
    @InjectModel(Link.name) private linkModel: Model<LinkDocument>,
    private cacheService: CacheService,
    private analyticsService: AnalyticsService,
  ) {}

  private inFlight = new Map<string, Promise<any>>();

  async create(longUrl: string, shortCode: string, userId: string, expiresAt?: string | null) {
    if(await this.isUrlExists(shortCode)) {
      throw new ConflictException('Short code already exists');
    }

    const newshortCode = shortCode || nanoid(7); // random 7-character code

    const link = await this.linkModel.create({
      short_code: newshortCode,
      long_url: longUrl,
      user_id: userId,
      expires_at: expiresAt ?? null,
    });

    let expiresAtFormatted: string | null = null;
    if (link.expires_at) {
      expiresAtFormatted = new Date(link.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    let createdAtFormatted: string =  new Date(link.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    return {
      short_code: link.short_code,
      long_url: link.long_url,
      expires_at: expiresAtFormatted,
      created_at: createdAtFormatted,
      clicks: 0,
      status: 'active',
    };
  }

  async resolveFromCache(shortCode: string): Promise<{ long_url: string; expires_at: Date | null } | null> {
    // 1. Try Redis first — this should handle ~99% of requests per your spec
    const cached = await this.cacheService.get(`link:${shortCode}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.notFound) return null;   // ← ADD: recognize the negative-cache marker on the hit path
      return parsed
    }

    // Dedupe: if a lookup for this exact code is already running, await it instead of firing a new one
    if (this.inFlight.has(shortCode)) {
      return this.inFlight.get(shortCode);
    }

    const promise = this.fetchAndCache(shortCode).finally(() => {
      this.inFlight.delete(shortCode);
    });

    this.inFlight.set(shortCode, promise);
    return promise;
  }

  private async fetchAndCache(shortCode: string) {
    const link = await this.linkModel.findOne({ short_code: shortCode }).lean();
    
    if (!link) {
      // ← THIS is where your snippet goes
      this.cacheService.set(`link:${shortCode}`, JSON.stringify({ notFound: true }), 60);
      return null;
    }
    if (link.expires_at && new Date(link.expires_at) < new Date()) return null;

    const payload = { long_url: link.long_url, expires_at: link.expires_at };
    const ttlSeconds = link.expires_at
      ? Math.floor((new Date(link.expires_at).getTime() - Date.now()) / 1000)
      : 60 * 60 * 24 * 30;

    this.cacheService.set(`link:${shortCode}`, JSON.stringify(payload), ttlSeconds);
    return payload;
  }

  async deleteByCode(code: string, userId: string) {
    const result = await this.linkModel.deleteOne({ short_code: code, user_id: userId });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Short link not found');
    }
    // invalidate cache — critical, or Redis serves a deleted link forever
    await this.cacheService.del(`link:${code}`);

    this.inFlight.delete(code)
  }

  async isUrlExists(code: string) {
    const link = await this.linkModel.findOne({ short_code: code });
    return !!link;
  }

  getLinkStatus(expiresAt: Date | null): 'active' | 'expiring' | 'expired' {
    if (!expiresAt) return 'active';

    const msRemaining = new Date(expiresAt).getTime() - Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    if (msRemaining <= 0) return 'expired';
    if (msRemaining <= sevenDaysMs) return 'expiring';
    return 'active';
  }
  
  async listLinks(userId: string, cursor?: string, limit = 10) {
    let query: any = { user_id: userId };

    if (cursor) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    const now = new Date()
    const [links, totalLinks, activeCount, totalClicksResult] = await Promise.all([
      this.linkModel.find(query).sort({ _id: -1 }).limit(limit),
      this.linkModel.countDocuments({ user_id: userId }),
      this.linkModel.countDocuments({
        user_id: userId,
        $or: [{ expires_at: null }, { expires_at: { $gt: now } }],
      }),
      this.linkModel.aggregate([
        { $match: { user_id: userId } },
        { $group: { _id: null, total: { $sum: '$clicks' } } },
      ]),
    ]);
    const clickCount = totalClicksResult[0]?.total ?? 0;
    let result =  links.map((link) => {
        let expiresAtFormatted: string | null = null;
        if (link.expires_at) {
          expiresAtFormatted = new Date(link.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        }

        let createdAtFormatted: string =  new Date(link.created_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });

        let status = this.getLinkStatus(link.expires_at);

        return {
          _id:link._id,
          short_code: link.short_code,
          long_url: link.long_url,
          clicks: link.clicks,
          expires_at: expiresAtFormatted, 
          created_at: createdAtFormatted,
          status: status,
        }
    });

    return {links: result, totalLinks, clickCount, activeCount}
  }

  async getLinkStats(code: string, userId: string) {
    const link = await this.linkModel.findOne({ short_code: code, user_id: userId });
    if (!link) {
      throw new NotFoundException('Short link not found');
    }

    let expiresAtFormatted: string | null = null;
    if (link.expires_at) {
      expiresAtFormatted = new Date(link.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    let createdAtFormatted: string =  new Date(link.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    
    let status = 'active';
    
    let result = {
      short_code: link.short_code,
      long_url: link.long_url,
      clicks: link.clicks,
      expires_at: expiresAtFormatted,
      created_at: createdAtFormatted,
      status: status,
    };

    const [clickTrend, countryBreakdown, referrerBreakdown, deviceBreakdown] = await Promise.all([
      this.analyticsService.getClickTrend(code, userId),
      this.analyticsService.getCountryBreakdown(code, userId),
      this.analyticsService.getReferrerBreakdown(code, userId),
      this.analyticsService.getDeviceBreakdown(code, userId),
    ]);

    result['click_trend'] = clickTrend
    result['country_breakdown'] = countryBreakdown
    result['referrer_breakdown'] = referrerBreakdown
    result['device_breakdown'] = deviceBreakdown

    return result;
  }
}
