import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ValiError } from 'valibot';

import type { RefreshTokenRequestInput } from '../../../../app/command/auth/refresh-token-command';
import type { RefreshTokenCommand } from '../../../../app/command/auth/refresh-token-command';
import { ApplicationError, ValidationError, AuthorizationError } from '../../../../app/errors';

// Define the expected variable type for this specific handler context
type RefreshHandlerEnv = {
  Variables: {
    refreshTokenCommand: RefreshTokenCommand;
  };
  Bindings: CloudflareBindings;
};

const app = new Hono<RefreshHandlerEnv>();

app.post('/refresh', async (c) => {
  let requestBody: RefreshTokenRequestInput;
  try {
    requestBody = await c.req.json() as RefreshTokenRequestInput;
  } catch (error) {
    throw new HTTPException(400, { message: 'Invalid JSON in request body' });
  }

  // --- Get command from context ---
  const command = c.var.refreshTokenCommand;
  if (!command) {
    console.error('RefreshTokenCommand not found in context. DI middleware might not have run.');
    throw new HTTPException(500, { message: 'Internal Server Configuration Error'});
  }
  // --- End Get command from context ---

  // Environment variable checks are now handled by the DI middleware in router.ts
  // or by the service constructors themselves.

  try {
    const tokens = await command.execute(requestBody); 
    return c.json(tokens, 200);
  } catch (error) {
    console.error('Error refreshing token:', error);
    if (error instanceof ValidationError) {
      throw new HTTPException(400, { message: error.message, cause: error.details });
    }
    if (error instanceof AuthorizationError) {
      throw new HTTPException(401, { message: error.message });
    }
    if (error instanceof ApplicationError) {
      throw new HTTPException(500, { message: error.message });
    }
    if (error instanceof ValiError) { 
      throw new HTTPException(400, { message: 'Invalid request body', cause: error.issues });
    }
    throw new HTTPException(500, { message: 'Failed to refresh token' });
  }
});

export default app; 