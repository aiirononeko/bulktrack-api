import type { DeviceId, User, UserDevice, UserId } from "./entity";

/**
 * リフレッシュトークンを永続化および取得するためのリポジトリインターフェース (Port)。
 * このインターフェースは Infrastructure 層 (例: KVストア) で実装されます。
 */
export interface ITokenRepository {
  /**
   * 指定されたデバイスIDに紐づくリフレッシュトークンを保存します。
   * 古いリフレッシュトークンが存在する場合は上書きされることを想定します。
   *
   * @param deviceId デバイスID
   * @param refreshToken 保存するリフレッシュトークン文字列
   * @param expiresInSeconds トークンの有効期間 (秒単位)。ストア側でTTL設定に使用します。
   * @returns Promise<void>
   */
  saveRefreshToken(
    deviceId: DeviceId,
    refreshToken: string,
    expiresInSeconds: number,
  ): Promise<void>;

  /**
   * 指定されたデバイスIDに紐づくリフレッシュトークンを取得します。
   *
   * @param deviceId デバイスID
   * @returns 見つかった場合はリフレッシュトークン文字列、見つからない場合は null。
   */
  findRefreshTokenByDeviceId(deviceId: DeviceId): Promise<string | null>;

  /**
   * 指定されたデバイスIDに紐づくリフレッシュトークンを削除します。
   *
   * @param deviceId デバイスID
   * @returns Promise<void>
   */
  deleteRefreshTokenByDeviceId(deviceId: DeviceId): Promise<void>;

  // 必要であれば、トークン文字列自体で検索・削除するメソッドも定義可能
  // findDeviceByRefreshToken(refreshToken: string): Promise<DeviceId | null>;
  // deleteRefreshToken(refreshToken: string): Promise<void>;
}

/**
 * ユーザー情報を永続化および取得するためのリポジトリインターフェース (Port)。
 */
export interface IUserRepository {
  /**
   * 新しい匿名ユーザーを作成し、永続化します。
   * @param initialDisplayName ユーザーの初期表示名（例: deviceId）
   * @returns 作成されたユーザーエンティティ。
   */
  createAnonymousUser(initialDisplayName: string): Promise<User>;

  /**
   * 指定されたIDのユーザーを取得します。
   * @param userId ユーザーID
   * @returns 見つかった場合はユーザーエンティティ、見つからない場合は null。
   */
  findById(userId: UserId): Promise<User | null>;
}

/**
 * デバイス情報を永続化および取得するためのリポジトリインターフェース (Port)。
 */
export interface IDeviceRepository {
  /**
   * 新しいデバイス情報を永続化します。
   * @param userDevice 保存するデバイスエンティティ。
   * @returns Promise<void>
   */
  save(userDevice: UserDevice): Promise<void>;

  /**
   * 指定されたデバイスIDのデバイス情報を取得します。
   * @param deviceId デバイスID
   * @returns 見つかった場合はデバイスエンティティ、見つからない場合は null。
   */
  findByDeviceId(deviceId: DeviceId): Promise<UserDevice | null>;
}
