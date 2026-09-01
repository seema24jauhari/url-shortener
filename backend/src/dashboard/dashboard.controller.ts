import { Controller, Req, UseGuards } from '@nestjs/common';
import * as express from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipThrottle } from '@nestjs/throttler';

interface JwtUser {
  sub: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

@Controller()
@SkipThrottle()
export class DashboardController {
  @Roles('user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  getStudentDashboard(@Req() req: express.Request) {
    const { iat: _iat, exp: _exp, ...user } = req.user as JwtUser;
    return { message: 'Welcome user', user: user };
  }
}
