// auth/strategies/github.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    config: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      clientID: config.get<string>('GITHUB_CLIENT_ID') ?? '',
      clientSecret: config.get<string>('GITHUB_CLIENT_SECRET') ?? '',
      callbackURL: `${config.get<string>('OAUTH_CALLBACK_BASE')}/auth/github/callback`,
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) throw new Error('No email returned from GitHub');

      const user = await this.usersService.findOrCreateOAuthUser({
        email,
        provider: 'github',
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
