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
      return JSON.parse(cached);
    }

    // 2. Cache miss — fall back to MongoDB
    const link = await this.linkModel.findOne({ short_code: shortCode }).lean();
    if (!link) return null; // truly doesn't exist → controller throws 404

    // 3. Check expiry before using/caching it
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return null; // expired → treat as not found
    }

    // 4. Populate Redis so the NEXT request for this code is a cache hit
    const payload = { long_url: link.long_url, expires_at: link.expires_at };
    const ttlSeconds = link.expires_at
      ? Math.floor((new Date(link.expires_at).getTime() - Date.now()) / 1000)
      : 60 * 60 * 24 * 30; // no expiry set → cache for 30 days as a default

    await this.cacheService.set(`link:${shortCode}`, JSON.stringify(payload), ttlSeconds);

    return payload;
  }

  async deleteByCode(code: string) {
    const result = await this.linkModel.deleteOne({ short_code: code });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Short link not found');
    }
    // invalidate cache — critical, or Redis serves a deleted link forever
    await this.cacheService.del(`link:${code}`);
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

    const links = await this.linkModel.find(query).sort({ _id: -1 }).limit(limit);
    return links.map((link) => {
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
  }

  async getLinkStats(code: string) {
    const link = await this.linkModel.findOne({ short_code: code });
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
      this.analyticsService.getClickTrend(code),
      this.analyticsService.getCountryBreakdown(code),
      this.analyticsService.getReferrerBreakdown(code),
      this.analyticsService.getDeviceBreakdown(code),
    ]);

    result['click_trend'] = clickTrend
    result['country_breakdown'] = countryBreakdown
    result['referrer_breakdown'] = referrerBreakdown
    result['device_breakdown'] = deviceBreakdown

    return result;
  }
}
