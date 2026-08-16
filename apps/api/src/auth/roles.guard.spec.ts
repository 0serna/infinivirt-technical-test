import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@support-ticketing/shared';
import { RolesGuard } from './roles.guard';

function createContext(userRole?: Role): ExecutionContext {
  const handler = () => undefined;
  const request = {
    user: userRole
      ? {
          id: 'user-1',
          email: 'user@example.com',
          displayName: 'User',
          role: userRole,
        }
      : undefined,
  };

  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflectorGetAllAndOverride: jest.Mock;

  beforeEach(() => {
    reflectorGetAllAndOverride = jest.fn();
    const reflector = {
      getAllAndOverride: reflectorGetAllAndOverride,
    } as unknown as Reflector;
    guard = new RolesGuard(reflector);
  });

  it('allows any authenticated caller when no minimum Role is declared', () => {
    reflectorGetAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext('agent'))).toBe(true);
  });

  it('allows Supervisor and Administrator when Supervisor is required', () => {
    reflectorGetAllAndOverride.mockReturnValue('supervisor');

    expect(guard.canActivate(createContext('supervisor'))).toBe(true);
    expect(guard.canActivate(createContext('admin'))).toBe(true);
  });

  it('rejects Agent when Supervisor is required', () => {
    reflectorGetAllAndOverride.mockReturnValue('supervisor');

    expect(() => guard.canActivate(createContext('agent'))).toThrow(
      ForbiddenException,
    );
  });

  it('allows only Administrator when Administrator is required', () => {
    reflectorGetAllAndOverride.mockReturnValue('admin');

    expect(guard.canActivate(createContext('admin'))).toBe(true);
    expect(() => guard.canActivate(createContext('supervisor'))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(createContext('agent'))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects with 401 when the request has no User', () => {
    reflectorGetAllAndOverride.mockReturnValue('agent');

    expect(() => guard.canActivate(createContext())).toThrow(
      UnauthorizedException,
    );
  });
});
