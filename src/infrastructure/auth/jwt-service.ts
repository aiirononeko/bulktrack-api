import { sign, verify } from 'hono/jwt';
import type { IJwtService } from '../../domain/auth/service';
import type { DeviceId, RefreshTokenPayload } from '../../domain/auth/entity';
import { TokenError, InvalidTokenError, TokenExpiredError } from '../../domain/auth/errors';

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
      type: 'device_access',
      iat: now,
      exp: now + expiresInSeconds,
    };
    try {
      return await sign(payload, this.jwtSecret);
    } catch (error) {
      console.error('Failed to sign access token:', error);
      throw new TokenError('Access token generation failed.');
    }
  }

  async generateRefreshToken(deviceId: DeviceId, expiresInSeconds: number): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: deviceId,
      type: 'device_refresh',
      iat: now,
      exp: now + expiresInSeconds,
    };
    try {
      return await sign(payload, this.jwtSecret);
    } catch (error) {
      console.error('Failed to sign refresh token:', error);
      throw new TokenError('Refresh token generation failed.');
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await verify(token, this.jwtSecret);
      if (payload && typeof payload.sub === 'string' && payload.type === 'device_refresh' && typeof payload.exp === 'number' && typeof payload.iat === 'number') {
        return payload as RefreshTokenPayload;
      }
      throw new InvalidTokenError('Invalid refresh token payload structure.');
    } catch (e: unknown) {
      const error = e as Error; 
      console.error('Refresh Token verification failed:', error.message || 'Unknown error');

      if (error.name === 'JWTExpired' || (error.name === 'JWTClaimValidationFailed' && error.message?.includes('expired'))) {
        throw new TokenExpiredError('Refresh token has expired.');
      }
      if (error.name === 'JWSSignatureVerificationFailed' || error.name === 'JWTMalformed' || error.name === 'JWTInvalid' || error.message?.includes('invalid') || error.message?.includes('malformed')){
        throw new InvalidTokenError('Refresh token is invalid or malformed.');
      }
      throw new TokenError('Refresh token verification failed due to an unexpected JWT processing error.');
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
