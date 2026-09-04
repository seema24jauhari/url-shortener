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

  async findByCode(code: string) {
    const cached = await this.cacheService.get(`link:${code}`);
    if (cached) return JSON.parse(cached);

    const link = await this.linkModel.findOne({ short_code: code });
    if (!link || (link.expires_at && link.expires_at < new Date())) {
      throw new NotFoundException('Short link not found or expired');
    }

    // compute TTL from expires_at, if the link has one
    const ttl = link.expires_at
      ? Math.max(1, Math.floor((link.expires_at.getTime() - Date.now()) / 1000))
      : undefined;

    // ← this is the line you asked about
    await this.cacheService.set(`link:${code}`, JSON.stringify(link), ttl);

    return link;
  }

  incrementClicks(code: string) {
  // no `await` here on purpose — fire and forget
    this.linkModel.updateOne({ short_code: code }, { $inc: { clicks: 1 } })
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

  async listLinks(userId: string, cursor?: string, limit = 10) {
    let query: any = { user_id: userId };

    if (cursor) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    const links = await this.linkModel.find(query).sort({ _id: -1, createdAt: -1 }).limit(limit);
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

        let status = 'active';
        if (link.expires_at && (link.expires_at.getTime() - new Date().getTime() == 1 * 7 * 24 * 60 * 60 * 1000)) {
          status = 'expiring';
        }
        else if (link.expires_at && link.expires_at < new Date()) {
          status = 'expired';
        }

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

    result['click_trend'] = await this.analyticsService.getClickTrend(code);
    result['country_breakdown'] = await this.analyticsService.getCountryBreakdown(code);
    result['referrer_breakdown'] = await this.analyticsService.getReferrerBreakdown(code);
    result['device_breakdown'] = await this.analyticsService.getDeviceBreakdown(code);

    return result;
  }
}
