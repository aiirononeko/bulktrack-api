import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type { StatusCode } from 'hono/utils/http-status';

import { ApplicationError } from '../../app/errors';
import deviceAuthRoutes from './handlers/auth/device';
import refreshAuthRoutes from './handlers/auth/refresh';

const app = new Hono<{ Bindings: CloudflareBindings }>();

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
// app.route('/v1/users', userRoutes);
// app.route('/v1/posts', postRoutes);

// Root path or health check (optional)
app.get('/', (c) => {
  return c.text('BulkTrack API is running!');
});

export default app;
