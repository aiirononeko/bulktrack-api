import {
  type InferOutput,
  literal,
  minLength,
  nonEmpty,
  number,
  object,
  pipe,
  string,
} from "valibot";

// DeviceId
export const DeviceIdSchema = pipe(
  string(),
  nonEmpty("Device ID cannot be empty."),
  minLength(36, "Device ID must be a valid UUID."),
);
export type DeviceId = InferOutput<typeof DeviceIdSchema>;

// AuthToken
// AuthTokenはドメインエンティティとしてより具体的な情報を持つこともあります。
// ここではトークン文字列そのものと有効期限を保持する例を示します。
export const AuthTokenSchema = object({
  accessToken: pipe(string(), nonEmpty("Access token cannot be empty.")),
  refreshToken: pipe(string(), nonEmpty("Refresh token cannot be empty.")),
  expiresIn: number(), // アクセストークンの有効期間 (秒単位など)
});
export type AuthToken = InferOutput<typeof AuthTokenSchema>;

// アクセストークンペイロードの例 (必要に応じて定義)
// export const AccessTokenPayloadSchema = object({
//   sub: string(), // Subject (e.g., device_id)
//   type: string(), // Token type (e.g., 'device_access')
//   exp: number(), // Expiration time (Unix timestamp)
//   // 他のクレーム
// });
// export type AccessTokenPayload = InferOutput<typeof AccessTokenPayloadSchema>;

// リフレッシュトークンペイロード
export const RefreshTokenPayloadSchema = object({
  sub: string(), // Subject (e.g., device_id) - Should ideally be DeviceId, but schema is string
  type: literal("device_refresh"), // Token type
  exp: number(), // Expiration time (Unix timestamp)
  iat: number(), // Issued at (Unix timestamp)
  // 他のクレーム
});
export type RefreshTokenPayload = InferOutput<typeof RefreshTokenPayloadSchema>;

// User ID (UUID v7想定)
export const UserIdSchema = pipe(
  string(),
  nonEmpty("User ID cannot be empty."),
  minLength(36, "User ID must be a valid UUID."),
);
export type UserId = InferOutput<typeof UserIdSchema>;

// User
export const UserSchema = object({
  id: UserIdSchema,
  displayName: string(), // 当面は deviceId などを初期値として利用想定
  // goalJson などは後ほど追加
});
export type User = InferOutput<typeof UserSchema>;

// UserDevice
export const UserDeviceSchema = object({
  deviceId: DeviceIdSchema,
  userId: UserIdSchema,
  platform: pipe(string(), minLength(1)), // e.g., 'iOS', 'Android' - 後でEnumにもできる
  linkedAt: string(), // ISO8601 datetime string
});
export type UserDevice = InferOutput<typeof UserDeviceSchema>;
