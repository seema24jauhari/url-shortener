// auth/strategies/google.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private usersService: UsersService,
  ) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    super({
      clientID,
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
      callbackURL: `${config.get<string>('OAUTH_CALLBACK_BASE')}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) throw new Error('No email returned from Google');

      const user = await this.usersService.findOrCreateOAuthUser({
        email,
        provider: 'google',
        providerId: profile.id,
        name: profile.displayName ?? email.split('@')[0], // ← add this
      });
      return user;
    } catch (err) {
      console.error('GoogleStrategy validate() error:', err);
      throw err;
    }
  }
}
