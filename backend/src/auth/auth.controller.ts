import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as express from 'express'; // ← namespace import
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User } from 'src/users/schemas/user.schema';
import { Document } from 'mongoose';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface AuthRequest extends express.Request {
  user: {
    id: string;
    sub: {
      _id: string;
    };
    email: string;
    roles: string[];
  };
}

@Controller('auth')
@SkipThrottle()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 min, THIS route only
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 min, THIS route only
  login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
    @Req() req: express.Request,
  ) {
    return this.authService.login(loginDto.email, loginDto.password, res, req);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 min, THIS route only
  refresh(@Req() req: express.Request) {
    return this.authService.refresh(req);
  }

  @Delete('logout')
  logout(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    return this.authService.logout(req, res);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Passport redirects to Google's consent screen — body never runs
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    return this.authService.handleOAuthLogin(req.user as User & Document, res);
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubLogin() {}

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    return this.authService.handleOAuthLogin(req.user as User & Document, res);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  setup(@Req() req: AuthRequest) {
    return this.authService.setupMfa(req.user.id);
  }

  @Post('mfa/login')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 min, THIS route only
  verifyMfa(@Body() body: { code: string }, @Req() req: AuthRequest) {
    return this.authService.verifyMfaLogin(req.user.sub._id, body.code);
  }

  @Post('forget-password')
  @HttpCode(200)
  forgotPassword(@Body() forgetPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgetPasswordDto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }
}
