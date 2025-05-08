import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type { StatusCode } from 'hono/utils/http-status';

import { ApplicationError } from '../../app/errors';
import deviceAuthRoutes from './handlers/auth/device';
import refreshAuthRoutes from './handlers/auth/refresh';

// --- DI Setup ---
// Import services and commands
import { JwtServiceImpl } from '../../infrastructure/auth/jwt-service';
import { KvTokenStoreImpl } from '../../infrastructure/kv/token-store';
import { AuthService as DomainAuthService } from '../../domain/auth/service';
import { ActivateDeviceCommand } from '../../app/command/auth/activate-device-command';
import { RefreshTokenCommand } from '../../app/command/auth/refresh-token-command';
import { UserRepositoryImpl } from '../../infrastructure/db/repository/user-repository'; // For ActivateDeviceCommand
import { DeviceRepositoryImpl } from '../../infrastructure/db/repository/device-repository'; // For ActivateDeviceCommand

// Define types for c.var
type AppEnv = {
  Variables: {
    activateDeviceCommand: ActivateDeviceCommand;
    refreshTokenCommand: RefreshTokenCommand;
  };
  Bindings: CloudflareBindings;
};

const app = new Hono<AppEnv>();

// Middleware for Dependency Injection for Auth routes
// This middleware will run for all routes starting with /v1/auth
app.use('/v1/auth/*', async (c, next) => {
  // Instantiate services (these could be singletons if Hono context allows for app-level singletons)
  // For workers, these are effectively request-scoped if instantiated here without further caching.
  // However, CloudflareBindings (c.env) are available, so services can be initialized using them.

  // Check for necessary bindings first
  if (!c.env.JWT_SECRET || !c.env.REFRESH_TOKENS_KV || !c.env.DB) {
    console.error('CRITICAL: Missing one or more environment bindings (JWT_SECRET, REFRESH_TOKENS_KV, DB) for auth services.');
    throw new HTTPException(500, { message: 'Internal Server Configuration Error for Auth' });
  }
  
  const jwtService = new JwtServiceImpl({ jwtSecret: c.env.JWT_SECRET });
  const tokenRepository = new KvTokenStoreImpl({ kv: c.env.REFRESH_TOKENS_KV });
  const authService = new DomainAuthService(jwtService);
  const userRepository = new UserRepositoryImpl(c.env.DB);
  const deviceRepository = new DeviceRepositoryImpl(c.env.DB);

  // Instantiate commands
  const activateDeviceCommand = new ActivateDeviceCommand({
    authService,
    tokenRepository,
    userRepository,
    deviceRepository,
  });
  const refreshTokenCommand = new RefreshTokenCommand({
    authService,
    jwtService, // RefreshTokenCommand needs jwtService directly for verification
    tokenRepository,
  });

  // Set commands in c.var
  c.set('activateDeviceCommand', activateDeviceCommand);
  c.set('refreshTokenCommand', refreshTokenCommand);

  await next();
});
// --- End DI Setup ---

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowHeaders: ['X-Device-Id', 'Content-Type', 'X-Platform'],
  allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Global Error Handler
app.onError((err, c) => {
  console.error('[GlobalErrorHandler]', err);

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  if (err instanceof ApplicationError) {
    c.status(err.statusCode as StatusCode);
    return c.json({
      error: {
        message: err.message,
        code: err.code,
        details: err.details,
      },
    });
  }

  // その他の予期せぬエラー (プログラムのバグなど)
  c.status(500 as StatusCode);
  return c.json({
    error: {
      message: 'An unexpected internal server error occurred.',
      code: 'INTERNAL_SERVER_ERROR',
    },
  });
});

// Route modules
app.route('/v1/auth', deviceAuthRoutes);
app.route('/v1/auth', refreshAuthRoutes);

// Root path or health check (optional)
app.get('/', (c) => {
  return c.text('BulkTrack API is running!');
});

export default app;
