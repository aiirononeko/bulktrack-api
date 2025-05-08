import type { DeviceId, AuthToken } from './entity';

// JWTサービスへのインターフェース (Port)
// このインターフェースは Infrastructure 層で実装されます。
export interface IJwtService {
  generateAccessToken(deviceId: DeviceId, expiresInSeconds: number): Promise<string>;
  generateRefreshToken(deviceId: DeviceId, expiresInSeconds: number): Promise<string>;
  // 必要に応じてトークン検証メソッドなども追加できます
  // verifyToken(token: string): Promise<any>; 
}

export class AuthService {
  private readonly jwtService: IJwtService;

  // 定数として有効期限を定義 (秒単位)
  public static readonly ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
  public static readonly REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

  constructor(jwtService: IJwtService) {
    this.jwtService = jwtService;
  }

  /**
   * 指定されたデバイスIDに対して新しい認証トークンを発行します。
   * @param deviceId デバイスID
   * @returns 発行されたアクセストークン、リフレッシュトークン、およびアクセストークンの有効期限を含むAuthTokenオブジェクト
   */
  public async issueAuthTokens(deviceId: DeviceId): Promise<AuthToken> {
    const accessToken = await this.jwtService.generateAccessToken(
      deviceId,
      AuthService.ACCESS_TOKEN_TTL_SECONDS
    );

    const refreshToken = await this.jwtService.generateRefreshToken(
      deviceId,
      AuthService.REFRESH_TOKEN_TTL_SECONDS
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: AuthService.ACCESS_TOKEN_TTL_SECONDS,
    };
  }
}
