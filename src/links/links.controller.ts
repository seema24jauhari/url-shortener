import { Body, Controller, Delete, Get, Param, Post, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import * as express from 'express'
import { AnalyticsService } from 'src/analytics/analytics.service';
@Controller('')
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly analyticsService: AnalyticsService
  ) {}

  @Post('links')
  create(@Body() createLinkDto: CreateLinkDto) {
    return this.linksService.create(createLinkDto.long_url);
  }

  @Get(':code')
  async redirect(@Param('code') code: string, @Req() req: express.Request, @Res() res: express.Response) {
    const link = await this.linksService.findByCode(code);
    this.linksService.incrementClicks(code); // fire-and-forget, no await

    this.analyticsService.logClick(
      code,
      req.ip?? '',
      req.headers['user-agent'] || '',
      req.headers['referer'] || '',
    ); // fire-and-forget
    return res.redirect(302, link.long_url);
  }

  @Delete(':code')
  async remove(@Param('code') code: string) {
    await this.linksService.deleteByCode(code);
    return { deleted: true };
  }
} 