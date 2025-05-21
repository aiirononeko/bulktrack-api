import { Hono } from 'hono';
import type { AppEnv } from '../../main.router';
import { setupSetDependencies } from '../../middleware/di/set.container';
import { jwtAuthMiddleware } from '../../middleware/auth.middleware';
import { 
  createAddSetHttpHandler,
  createUpdateSetHttpHandler,
  createDeleteSetHttpHandler
} from './set.handlers';

const setApp = new Hono<AppEnv>();

// Apply DI middleware for all routes in this set module
setApp.use('*', async (c, next) => {
  setupSetDependencies(c.env, c);
  await next();
});

// Apply JWT authentication for all set routes
setApp.use('*', jwtAuthMiddleware);

// POST /v1/sets - Add a new set
setApp.post('/', createAddSetHttpHandler());

// PATCH /v1/sets/:setId - Update an existing set
setApp.patch('/:setId', createUpdateSetHttpHandler());

// DELETE /v1/sets/:setId - Delete a set
setApp.delete('/:setId', createDeleteSetHttpHandler());

export default setApp;
