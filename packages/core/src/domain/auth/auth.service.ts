import type { UserIdVO } from "../shared/value-objects/identifier";
import type { AuthToken, RefreshTokenPayload } from "./auth.entity";

// JWTサービスへのインターフェース (Port)
// このインターフェースは Infrastructure 層で実装されます。
export interface IJwtService {
  generateAccessToken(
    userId: UserIdVO,
    expiresInSeconds: number,
  ): Promise<string>;
  generateRefreshToken(
    userId: UserIdVO,
    expiresInSeconds: number,
  ): Promise<string>;
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
  // 必要に応じてトークン検証メソッドなども追加できます
  // verifyToken(token: string): Promise<any>;
}

export class AuthService {
  private readonly jwtService: IJwtService;

  // 定数として有効期限を定義 (秒単位)
  public static readonly ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 60 minutes
  public static readonly REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

  constructor(jwtService: IJwtService) {
    this.jwtService = jwtService;
  }

  /**
   * 指定されたユーザーIDに対して新しい認証トークンを発行します。
   * @param userId ユーザーID
   * @returns 発行されたアクセストークン、リフレッシュトークン、およびアクセストークンの有効期限を含むAuthTokenオブジェクト
   */
  public async issueAuthTokens(userId: UserIdVO): Promise<AuthToken> {
    const accessToken = await this.jwtService.generateAccessToken(
      userId,
      AuthService.ACCESS_TOKEN_TTL_SECONDS,
    );

    const refreshToken = await this.jwtService.generateRefreshToken(
      userId,
      AuthService.REFRESH_TOKEN_TTL_SECONDS,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: AuthService.ACCESS_TOKEN_TTL_SECONDS,
    };
  }
}
