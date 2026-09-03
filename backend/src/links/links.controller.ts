import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import * as express from 'express'
import { AnalyticsService } from 'src/analytics/analytics.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('links')
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly analyticsService: AnalyticsService
  ) {}

  @Post('create-link')
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

  @Post('is-exists/:code')
  @HttpCode(200)
  async isUrlExists(@Param('code') code: string) {
    const exists = await this.linksService.isUrlExists(code);
    return { exists };
  }

  @Post('list')
  @HttpCode(200)
  async list(@Req() req: Request & { user: { sub: string } }) {
    const links = await this.linksService.listLinks(req.user.sub);
    return { links };
  }
} 