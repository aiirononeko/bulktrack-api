import { Hono } from 'hono';
import deviceAuthRoutes from './handlers/auth/device';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Middleware (logging, cors, etc. can be added here)
// app.use('*', logger()); // Example: Hono標準のロガー
// app.use('*', cors());  // Example: CORSミドルウェア

// Route modules
app.route('/v1/auth', deviceAuthRoutes);
// app.route('/v1/users', userRoutes);
// app.route('/v1/posts', postRoutes);

// Root path or health check (optional)
app.get('/', (c) => {
  return c.text('BulkTrack API is running!');
});

export default app;
