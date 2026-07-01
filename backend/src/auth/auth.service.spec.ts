import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<UsersService, 'findByEmail' | 'create' | 'findById'>
  >;

  const makeUser = (overrides: Partial<UserDocument> = {}): UserDocument =>
    ({
      id: 'user-id-1',
      email: 'existing@example.com',
      passwordHash: 'irrelevant',
      role: 'customer',
      ...overrides,
    }) as UserDocument;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    };

    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    } as unknown as JwtService;

    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'access-secret',
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_ACCESS_EXPIRES: '15m',
          JWT_REFRESH_EXPIRES: '7d',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService,
      configService,
    );
  });

  describe('signup', () => {
    it('rejects signup with an email that already exists', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());

      await expect(
        service.signup({
          email: 'existing@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('hashes the password before storing a new user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation((email, passwordHash, role) =>
        Promise.resolve(makeUser({ email, passwordHash, role })),
      );

      await service.signup({
        email: 'new@example.com',
        password: 'password123',
      });

      const [, storedHash] = usersService.create.mock.calls[0];
      expect(storedHash).not.toBe('password123');
      expect(await bcrypt.compare('password123', storedHash)).toBe(true);
    });
  });

  describe('login', () => {
    it('rejects login for an email that does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects login with the wrong password', async () => {
      const correctHash = await bcrypt.hash('correct-password', 10);
      usersService.findByEmail.mockResolvedValue(
        makeUser({ passwordHash: correctHash }),
      );

      await expect(
        service.login({
          email: 'existing@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('succeeds and returns tokens for correct credentials', async () => {
      const correctHash = await bcrypt.hash('correct-password', 10);
      usersService.findByEmail.mockResolvedValue(
        makeUser({ passwordHash: correctHash }),
      );

      const result = await service.login({
        email: 'existing@example.com',
        password: 'correct-password',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.user.email).toBe('existing@example.com');
    });
  });
});
