import { object, string, number, nonEmpty, type InferOutput, pipe, minLength } from 'valibot';

// DeviceId
export const DeviceIdSchema = pipe(
  string(),
  nonEmpty('Device ID cannot be empty.'),
  minLength(36, 'Device ID must be a valid UUID.')
);
export type DeviceId = InferOutput<typeof DeviceIdSchema>;

// AuthToken
// AuthTokenはドメインエンティティとしてより具体的な情報を持つこともあります。
// ここではトークン文字列そのものと有効期限を保持する例を示します。
export const AuthTokenSchema = object({
  accessToken: pipe(string(), nonEmpty('Access token cannot be empty.')),
  refreshToken: pipe(string(), nonEmpty('Refresh token cannot be empty.')),
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

// リフレッシュトークンペイロードの例 (必要に応じて定義)
// export const RefreshTokenPayloadSchema = object({
//   sub: string(), // Subject (e.g., device_id)
//   type: string(), // Token type (e.g., 'device_refresh')
//   exp: number(), // Expiration time (Unix timestamp)
//   // 他のクレーム
// });
// export type RefreshTokenPayload = InferOutput<typeof RefreshTokenPayloadSchema>;
