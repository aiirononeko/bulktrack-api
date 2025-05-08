import { sign } from 'hono/jwt';
import type { IJwtService } from '../../domain/auth/service';
import type { DeviceId } from '../../domain/auth/entity';

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
