import { Body, Controller, Delete, Get, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import * as express from 'express'
@Controller('')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post('links')
  create(@Body() createLinkDto: CreateLinkDto) {
    return this.linksService.create(createLinkDto.long_url);
  }

  @Get(':code')
  async redirect(@Param('code') code: string, @Res() res: express.Response) {
    const link = await this.linksService.findByCode(code);
    this.linksService.incrementClicks(code); // fire-and-forget, no await
    return res.redirect(302, link.long_url);
  }

  @Delete(':code')
  async remove(@Param('code') code: string) {
    await this.linksService.deleteByCode(code);
    return { deleted: true };
  }
} 