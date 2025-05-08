import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { ActivateDeviceCommand } from '../../../../app/command/auth/activate-device-command';
import { AuthService } from '../../../../domain/auth/service';
import { JwtServiceImpl } from '../../../../infrastructure/auth/jwt-service';
import { KvTokenStoreImpl } from '../../../../infrastructure/kv/token-store';

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.post('/device', async (c) => {
  const deviceId = c.req.header('x-device-id');

  if (!deviceId) {
    console.error('X-Device-Id header is required');
    throw new HTTPException(400, { message: 'X-Device-Id header is required' });
  }

  // --- 依存関係の構築 ---
  // シークレットやKV名前空間は環境変数から取得することを想定
  if (!c.env.JWT_SECRET) {
    console.error('JWT_SECRET not configured');
    throw new HTTPException(500, { message: 'Internal server error: JWT_SECRET not configured' });
  }
  if (!c.env.REFRESH_TOKENS_KV) { // wrangler.toml で設定するKVバインディング名 (修正)
    console.error('REFRESH_TOKENS_KV not configured');
    throw new HTTPException(500, { message: 'Internal server error: REFRESH_TOKENS_KV not configured' });
  }

  const jwtService = new JwtServiceImpl({ jwtSecret: c.env.JWT_SECRET });
  const tokenRepository = new KvTokenStoreImpl({ kv: c.env.REFRESH_TOKENS_KV });
  const authService = new AuthService(jwtService);

  const command = new ActivateDeviceCommand({
    authService,
    tokenRepository,
  });
  // --- 依存関係の構築完了 ---

  try {
    const tokens = await command.execute({ deviceId });
    return c.json(tokens, 200);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid device ID:')) {
      console.error(`Invalid device ID: ${deviceId}`, error);
      throw new HTTPException(400, { message: error.message });
    }
    console.error('Error activating device:', error);
    // ActivateDeviceCommand内でValiErrorをキャッチして汎用Errorを投げているため、
    // ここではそのメッセージを元に判断するか、より具体的なカスタムエラーを定義する
    throw new HTTPException(500, { message: 'Failed to activate device' });
  }
});

export default app; // これを router.ts でマウントする想定
