import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { nanoid } from 'nanoid';
import { Link, LinkDocument } from './schemas/link.schema';
import { Model } from 'mongoose';
import { CacheService } from 'src/cache/cache.service';

export interface LinkType {
  short_code: string;
  long_url: string;
}

@Injectable()
export class LinksService {
  constructor(
    @InjectModel(Link.name) private linkModel: Model<LinkDocument>,
    private cacheService: CacheService,
  ) {}

  async create(longUrl: string, shortCode: string, expiresAt?: string | null) {
    if(await this.isUrlExists(shortCode)) {
      throw new ConflictException('Short code already exists');
    }

    const newshortCode = shortCode || nanoid(7); // random 7-character code

    const link = await this.linkModel.create({
      short_code: newshortCode,
      long_url: longUrl,
      expires_at: expiresAt ?? null,
    });

    return {
      short_code: link.short_code,
      long_url: link.long_url,
      expires_at: link.expires_at,
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
    this.linkModel.updateOne({ short_code: code }, { $inc: { clicks: 1 } }).exec();
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
}
