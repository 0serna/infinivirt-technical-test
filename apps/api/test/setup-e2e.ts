import 'reflect-metadata';

process.env.JWT_SECRET ??= 'test-jwt-secret-for-e2e';
process.env.JWT_EXPIRES_IN ??= '8h';
