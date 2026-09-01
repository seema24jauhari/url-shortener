import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as express from 'express'; // ← make sure this is at the top
import { UsersService } from '../users/users.service';
import { TokensService } from '../tokens/tokens.service';
import { CacheService } from '../cache/cache.service';
import { logger } from '../common/logger';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { User } from 'src/users/schemas/user.schema';
import { Document } from 'mongoose';
import { MailService } from 'src/mail/mail.service';
import * as crypto from 'crypto';

interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  roles: string[];
  exp?: number;
  iat?: number;
  password?: string;
}
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private tokensService: TokensService,
    private jwtService: JwtService,
    private config: ConfigService,
    private cacheService: CacheService,
    private mailService: MailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const password_hash = await argon2.hash(registerDto.password, {
      type: argon2.argon2id,
    });
    const user = await this.usersService.create(
      registerDto.email,
      password_hash,
      registerDto.name,
      registerDto.role,
    );

    return { id: user._id, email: user.email, roles: user.roles };
  }

  async login(
    email: string,
    password: string,
    res: express.Response,
    req: express.Request,
  ) {
    const user = await this.usersService.findByEmailWithPasswordHash(email);
    if (!user) {
      logger.error('Login failed: User not found', {
        email,
        correlationId: req.correlationId,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      logger.error('Login failed: Password Not Match', {
        email,
        correlationId: req.correlationId,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const access_token = this.jwtService.sign({
      sub: user._id,
      email: user.email,
      name: user.name,
      roles: user.roles,
    });

    const payload = {
      sub: user._id,
      email: email,
      name: user.name,
      roles: user.roles,
    };
    const refresh_token = this.jwtService.sign(payload, {
      secret: this.config.get<string>('REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true, // JavaScript on the page CANNOT read this cookie
      secure: this.config.get<string>('NODE_ENV') === 'production', // ← false in dev, true in prod
      sameSite: 'strict', // not sent on cross-site requests (CSRF protection)
      expires: expiresAt,
    });

    await this.tokensService.create(
      user._id.toString(),
      refresh_token,
      expiresAt,
    );
    logger.info('Login successful', {
      email,
      userId: user._id,
      correlationId: req.correlationId,
    });
    return { access_token, name: user.name, roles: user.roles };
  }

  // auth.service.ts
  async refresh(req: express.Request) {
    const token: string | undefined = req.cookies?.refresh_token as
      | string
      | undefined;
    if (!token) throw new UnauthorizedException('No refresh token');

    // check if token is blacklisted/deleted
    let isBlacklisted: boolean;
    try {
      isBlacklisted = await this.cacheService.isBlacklisted(token);
    } catch {
      // Redis is down/unreachable — fall back to MongoDB instead of trusting blindly
      isBlacklisted = !(await this.tokensService.isValid(token));
    }

    if (isBlacklisted) throw new UnauthorizedException('Token revoked');

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('REFRESH_SECRET'),
      });

      // Issue a new access token
      const access_token = this.jwtService.sign({
        sub: payload.sub,
        email: payload.email,
        roles: payload.roles,
        name: payload.name,
      });

      return { access_token, name: payload.name, roles: payload.roles };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(req: express.Request, res: express.Response) {
    const token: string = req.cookies?.refresh_token as string;

    // blacklist it — even if attacker has this token, it won't work
    await this.tokensService.revoke(token);

    if (token) {
      const decoded: JwtPayload = this.jwtService.decode(token);
      if (!decoded || !decoded.exp) throw new UnauthorizedException();

      const ttl = decoded.exp - Math.floor(Date.now() / 1000); // seconds left on token
      await this.cacheService.blacklistToken(token, ttl); // Redis — instant check going forward
    }
    res.clearCookie('refresh_token');
    return { message: 'Logged out' };
  }

  // auth.service.ts — add this method, reusing your existing token-issuing logic
  async handleOAuthLogin(user: User & Document, res: express.Response) {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      roles: user.roles,
    };
    const access_token = this.jwtService.sign(payload);
    const refresh_token = this.jwtService.sign(
      { sub: user._id, email: user.email },
      { secret: this.config.get<string>('REFRESH_SECRET'), expiresIn: '7d' },
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      expires: expiresAt,
    });

    await this.tokensService.create(
      user._id.toString(),
      refresh_token,
      expiresAt,
    );
    logger.info('OAuth login successful', {
      email: user.email,
      provider: user.provider,
    });

    return { access_token };
  }

  async setupMfa(userId: string) {
    const user = await this.usersService.findByIdForMFA(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const secret: { base32: string; otpauth_url?: string } =
      speakeasy.generateSecret({
        name: `JWTAuth (${user.email})`,
      });

    if (!secret.otpauth_url) {
      throw new Error('OTP URL not generated');
    }

    user.mfa_secret = secret.base32;
    await user.save();

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return {
      qrCode,
    };
  }

  async verifyMfaLogin(userId: string, code: string) {
    const user = await this.usersService.findByIdForMFA(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.mfa_secret) {
      throw new UnauthorizedException('MFA is not enabled for this user');
    }

    const valid = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: code,
    });

    if (!valid) {
      throw new UnauthorizedException('Invalid code');
    }

    const access_token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      roles: user.roles,
    });

    return {
      access_token,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('User not found');

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour

    await this.usersService.updateOne(
      { email },
      {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    );

    await this.mailService.sendResetEmail(email, token);
    return { message: 'Reset email sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }, // not expired
    });

    if (!user) throw new BadRequestException('Invalid or expired token');

    const password_hash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
    });
    user.password_hash = password_hash;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    return { message: 'Password reset successful' };
  }
}
