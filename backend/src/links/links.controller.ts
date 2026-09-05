import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import * as express from 'express'
import { AnalyticsService } from 'src/analytics/analytics.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import * as QRCode from 'qrcode';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import * as crypto from 'crypto';


@Controller('')
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly analyticsService: AnalyticsService,
    @InjectQueue('click-events') private clickQueue: Queue,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('links/create-link')
  @HttpCode(200)
  create(@Body() createLinkDto: CreateLinkDto, @Req() req: Request & { user: { sub: string } }) {
    const now = new Date();
    let newDate:string = "";
    if(!createLinkDto.expires_at){
      newDate = new Date(now.getFullYear()+1, now.getMonth(), now.getDate()).toISOString();
    }
    else{
      const [year, month, day ] = createLinkDto.expires_at?.split("-").map(Number);      
      newDate = new Date(year, month - 1, day).toISOString();
    }
    return this.linksService.create(createLinkDto.long_url, createLinkDto.short_code, req.user.sub, newDate);
  }

  @Get(':code')
  async redirect(@Param('code') code: string, @Req() req: express.Request, @Res() res: express.Response) {
    const link = await this.linksService.resolveFromCache(code);
    if (!link) throw new NotFoundException('Link not found')

    let ipHash = ""
    if(req.ip){
      ipHash = crypto.createHash('sha256').update(req.ip).digest('hex');
    }
    
    this.clickQueue.add('log-click', {
      short_code: code,
      ip_hash: ipHash,
      referrer: req.headers.referer ?? 'direct',
      user_agent: req.headers['user-agent']
    });
    
    return res.redirect(302, link.long_url);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('links/:code')
  async remove(@Param('code') code: string) {
    await this.linksService.deleteByCode(code);
    return { deleted: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('links/is-exists/:code')
  @HttpCode(200)
  async isUrlExists(@Param('code') code: string) {
    const exists = await this.linksService.isUrlExists(code);
    return { exists };
  }

  @UseGuards(JwtAuthGuard)  
  @Post('links/list')
  @HttpCode(200)
  async list(@Req() req: Request & { user: { sub: string } }, @Query('cursor') cursor?: string, @Query('limit') limit?: number) {
    const links = await this.linksService.listLinks(req.user.sub, cursor, limit);
    return links;
  }

  @UseGuards(JwtAuthGuard)  
  @Post('links/:code/stats')
  @HttpCode(200)
  async fetchStats(@Param('code') code: string, @Req() req: Request & { user: { sub: string } }) {
    const stats = await this.linksService.getLinkStats(code);
    return { stats };
  }

  @UseGuards(JwtAuthGuard)
  @Get('links/:code/qr')
  async getQrCode(@Param('code') code: string, @Res() res: express.Response) {
    const link = await this.linksService.resolveFromCache(code);
    if (!link) throw new NotFoundException('Link not found');

    const shortUrl = `${process.env.SHORTENER_DOMAIN}/${code}`;

    const qrBuffer = await QRCode.toBuffer(shortUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#0B0F0E', light: '#FAFAF7' }, // matches your app's palette
    });

    res.set({ 'Content-Type': 'image/png' });
    res.send(qrBuffer);
  }
} 