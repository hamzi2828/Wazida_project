import { ApiKeyGuard } from './api-key.guard';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let configService: ConfigService;
  let reflector: Reflector;

  function createMockContext(apiKey?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: apiKey ? { 'x-api-key': apiKey } : {},
        }),
      }),
      getHandler: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    configService = new ConfigService({
      SYNC_API_KEY: 'test-secret-key',
    });
    reflector = new Reflector();
    guard = new ApiKeyGuard(configService, reflector);
  });

  it('should allow access with valid API key', () => {
    const context = createMockContext('test-secret-key');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException with invalid API key', () => {
    const context = createMockContext('wrong-key');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when API key is missing', () => {
    const context = createMockContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should allow access when no expected key is configured', () => {
    configService = new ConfigService({});
    guard = new ApiKeyGuard(configService, reflector);

    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });
});
