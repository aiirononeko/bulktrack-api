import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

import deviceAuthRoutes from './handlers/auth/device';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowHeaders: ['X-Device-Id', 'Content-Type'],
  allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Route modules
app.route('/v1/auth', deviceAuthRoutes);
// app.route('/v1/users', userRoutes);
// app.route('/v1/posts', postRoutes);

// Root path or health check (optional)
app.get('/', (c) => {
  return c.text('BulkTrack API is running!');
});

export default app;
