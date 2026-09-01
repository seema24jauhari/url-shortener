import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import * as express from 'express'; // ← namespace import
import { SkipThrottle } from '@nestjs/throttler';

@Controller('users')
@SkipThrottle()
export class UsersController {
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: express.Request) {
    return req.user; // { sub, email } — set by JwtStrategy.validate()
  }
}
