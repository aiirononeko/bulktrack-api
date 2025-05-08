import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ValiError } from 'valibot';

import { RefreshTokenCommand, type RefreshTokenRequestInput } from '../../../../app/command/auth/refresh-token-command';
import { JwtServiceImpl } from '../../../../infrastructure/auth/jwt-service'; // Corrected: Only JwtServiceImpl
import { KvTokenStoreImpl } from '../../../../infrastructure/kv/token-store';
import { ApplicationError, ValidationError, AuthorizationError } from '../../../../app/errors';
import { AuthService as DomainAuthService } from '../../../../domain/auth/service';

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.post('/refresh', async (c) => {
  let requestBody: RefreshTokenRequestInput;
  try {
    requestBody = await c.req.json() as RefreshTokenRequestInput;
  } catch (error) {
    throw new HTTPException(400, { message: 'Invalid JSON in request body' });
  }

  // --- 依存関係の構築 ---
  if (!c.env.JWT_SECRET) {
    console.error('JWT_SECRET not configured');
    throw new HTTPException(500, { message: 'Internal server error: JWT_SECRET not configured' });
  }
  if (!c.env.REFRESH_TOKENS_KV) {
    console.error('REFRESH_TOKENS_KV not configured');
    throw new HTTPException(500, { message: 'Internal server error: REFRESH_TOKENS_KV not configured' });
  }
  // DBはRefreshTokenCommandでは直接使わないが、AuthService等が間接的に必要とする可能性は0ではない。
  // device.tsに倣ってチェックだけ入れておくか、コマンドの依存性から判断。
  // RefreshTokenCommandのdepsを見る限り、DBは直接不要。

  const jwtService = new JwtServiceImpl({ jwtSecret: c.env.JWT_SECRET });
  const tokenRepository = new KvTokenStoreImpl({ kv: c.env.REFRESH_TOKENS_KV });
  const authService = new DomainAuthService(jwtService); // Domain AuthService を使用

  const command = new RefreshTokenCommand({
    authService,
    jwtService, 
    tokenRepository,
  });
  // --- 依存関係の構築完了 ---

  try {
    const tokens = await command.execute(requestBody); 
    return c.json(tokens, 200);
  } catch (error) {
    console.error('Error refreshing token:', error);
    if (error instanceof ValidationError) {
      // ValidationErrorのdetailsにValiErrorのissuesが格納されている想定
      throw new HTTPException(400, { message: error.message, cause: error.details });
    }
    if (error instanceof AuthorizationError) {
      throw new HTTPException(401, { message: error.message }); // Removed cause as AuthorizationError doesn't typically have `issues`
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