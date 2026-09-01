import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokensService } from '../tokens/tokens.service';
import * as argon2 from 'argon2';
import { CacheService } from '../cache/cache.service';
import * as express from 'express';

describe('AuthService', () => {
  let authService: AuthService;

  // Fake versions of every dependency AuthService needs
  const mockUsersService = {
    findByEmail: jest.fn(),
    findByEmailWithPasswordHash: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockTokensService = {
    create: jest.fn(),
  };

  const mockCacheService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TokensService, useValue: mockTokensService },
        { provide: CacheService, useValue: mockCacheService }, // ← add this line
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // reset fakes between tests so they don't leak state
  });

  describe('register', () => {
    it('should throw ConflictException if email already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        email: 'test@test.com',
      }); // fake: user exists

      await expect(
        authService.register({
          email: 'test@test.com',
          password: 'pass123',
          name: 'John',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a new user if email does not exist', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        _id: 'fake-id-123',
        email: 'new@test.com',
        roles: ['user'],
      });

      const result = await authService.register({
        email: 'new@test.com',
        password: 'pass123',
        name: 'Rams',
      });

      expect(result).toEqual({
        id: 'fake-id-123',
        email: 'new@test.com',
        roles: ['user'],
      }); // ← added roles
      expect(mockUsersService.create).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findByEmailWithPasswordHash.mockResolvedValue(null);

      const fakeReq = { correlationId: 'test-id' } as express.Request;
      const fakeRes: Partial<express.Response> = { cookie: jest.fn() };

      await expect(
        authService.login(
          'notfound@test.com',
          'anypass',
          fakeRes as express.Response,
          fakeReq,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      mockUsersService.findByEmailWithPasswordHash.mockResolvedValue({
        _id: 'user-id',
        email: 'test@test.com',
        password_hash: await argon2.hash('correctpassword'),
        roles: ['user'],
      });

      const fakeReq = { correlationId: 'test-id' } as express.Request;
      const fakeRes: Partial<express.Response> = { cookie: jest.fn() };

      await expect(
        authService.login(
          'test@test.com',
          'wrongpassword',
          fakeRes as express.Response,
          fakeReq,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
