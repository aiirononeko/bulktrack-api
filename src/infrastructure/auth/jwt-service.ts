import { sign, verify } from 'hono/jwt';
import type { IJwtService } from '../../domain/auth/service';
import type { DeviceId, RefreshTokenPayload } from '../../domain/auth/entity';
import { AuthorizationError } from '../../app/errors';

interface JwtServiceConstructorParams {
  jwtSecret: string; 
  // issuerやaudienceなど、必要に応じて追加
  // issuer?: string;
  // audience?: string;
}

export class JwtServiceImpl implements IJwtService {
  private readonly jwtSecret: string;
  // private readonly issuer?: string;
  // private readonly audience?: string;

  constructor(params: JwtServiceConstructorParams) {
    if (!params.jwtSecret) {
      throw new Error('JWT_SECRET is required for JwtServiceImpl');
    }
    this.jwtSecret = params.jwtSecret;
    // this.issuer = params.issuer;
    // this.audience = params.audience;
  }

  async generateAccessToken(deviceId: DeviceId, expiresInSeconds: number): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: deviceId,
      type: 'device_access', // トークンタイプを明確化
      iat: now,
      exp: now + expiresInSeconds,
      // iss: this.issuer, // 必要であれば
      // aud: this.audience, // 必要であれば
    };
    // Honoのsign関数はデフォルトでHS256アルゴリズムを使用します。
    return sign(payload, this.jwtSecret);
  }

  async generateRefreshToken(deviceId: DeviceId, expiresInSeconds: number): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: deviceId,
      type: 'device_refresh', // トークンタイプを明確化
      iat: now,
      exp: now + expiresInSeconds,
      // iss: this.issuer, // 必要であれば
      // aud: this.audience, // 必要であれば
    };
    // リフレッシュトークンにはより長い有効期限や、異なるクレームセットを持たせることが一般的
    return sign(payload, this.jwtSecret);
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await verify(token, this.jwtSecret);
      // ここでpayloadの型をRefreshTokenPayloadSchemaでバリデーションするのがより堅牢
      // Valibotのparseを使うなど
      if (payload && typeof payload.sub === 'string' && payload.type === 'device_refresh' && typeof payload.exp === 'number' && typeof payload.iat === 'number') {
        return payload as RefreshTokenPayload;
      }
      // If condition not met, throw error (else is redundant due to early return/throw)
      throw new AuthorizationError('Invalid refresh token payload structure.');
    } catch (e: unknown) {
      const error = e as Error;
      // Hono/jwtのverifyはエラー時に型情報が限定的な場合があるためanyで受ける
      // エラーの種類に応じてログを詳細化したり、異なるエラーをスローしたりできる
      console.error('Refresh Token verification failed:', error.message || 'Unknown error');

      let errorMessage = 'Failed to verify refresh token due to an unexpected error.';
      let errorName = '';
      if (error && typeof error.name === 'string') {
        errorName = error.name;
      }
      if (error && typeof error.message === 'string') {
        // Try to get more specific error messages
        if (errorName === 'JwtTokenInvalid' || error.message.includes('invalid') || error.message.includes('malformed')) {
          errorMessage = 'Refresh token is invalid or malformed.';
        } else if (errorName === 'JwtTokenExpired' || error.message.includes('expired')) {
          errorMessage = 'Refresh token has expired.';
        } else if (error.message.toLowerCase().includes('jwt')) {
          errorMessage = 'Refresh token verification failed due to a JWT processing error.';
        }
      }
      throw new AuthorizationError(errorMessage);
    }
  }

  // トークン検証メソッド (必要になったら実装)
  // import { verify } from 'hono/jwt';
  // async verifyToken(token: string): Promise<any> {
  //   try {
  //     // Honoのverify関数は検証に失敗すると例外をスローする可能性があります。
  //     // また、戻り値はペイロードそのものです。
  //     const payload = await verify(token, this.jwtSecret);
  //     return payload;
  //   } catch (error) {
  //     // エラー処理 (例: トークン無効、期限切れなど)
  //     console.error('Token verification failed:', error);
  //     throw new Error('Invalid token'); // or a more specific error
  //   }
  // }
}
