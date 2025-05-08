# 認証と認可

BulkTrack API の認証および認可システムの詳細について説明します。

## 1. 概要

本システムでは、主にデバイスを起点とした認証フローを採用しています。ユーザーは初回起動時にアカウント作成やログイン操作を必要とせず（Zero-tap onboarding）、デバイス固有のID (`X-Device-Id`) を用いて認証を開始します。

認証には以下の2種類のJWT (JSON Web Token) を使用します。

*   **ユーザーアクセストークン (User Access Token)**: 保護されたAPIエンドポイントへのアクセスに使用される、短命なトークン。
*   **ユーザーリフレッシュトークン (User Refresh Token)**: 新しいアクセストークンを取得するための、長命なトークン。

## 2. トークンの種類とクレーム

### 2.1. ユーザーアクセストークン (`user_access`)

*   **目的**: 保護されたAPIリクエスト時に `Authorization: Bearer <token>` ヘッダーに含めて送信し、ユーザーを認証します。
*   **クレーム (Payload)**:
    *   `sub`: ユーザーID (`users.id`)。リソースへのアクセス権限を持つ主体を示します。
    *   `type`: トークン種別。固定値 `"user_access"`。
    *   `iat`: トークン発行時刻 (Unixタイムスタンプ)。
    *   `exp`: トークン有効期限 (Unixタイムスタンプ)。
*   **有効期間 (TTL)**: 15分 (AuthService.ACCESS_TOKEN_TTL_SECONDS)
*   **署名アルゴリズム**: HS256 (環境変数 `JWT_SECRET` を使用)

### 2.2. ユーザーリフレッシュトークン (`user_refresh`)

*   **目的**: アクセストークンの有効期限が切れた際に、新しいアクセストークンとリフレッシュトークンのペアを取得するために使用します。
*   **クレーム (Payload)**:
    *   `sub`: ユーザーID (`users.id`)。
    *   `type`: トークン種別。固定値 `"user_refresh"`。
    *   `iat`: トークン発行時刻 (Unixタイムスタンプ)。
    *   `exp`: トークン有効期限 (Unixタイムスタンプ)。
*   **有効期間 (TTL)**: 90日 (AuthService.REFRESH_TOKEN_TTL_SECONDS)
*   **保存場所**: Cloudflare Workers KV。キーは `refreshtoken_user:<userId>`。ユーザーごとに1つのリフレッシュトークンが保存され、新しいものが発行されると上書きされます。
*   **署名アルゴリズム**: HS256 (環境変数 `JWT_SECRET` を使用)

## 3. 認証フロー

### 3.1. デバイスアクティベーション (`POST /v1/auth/device`)

ユーザーがアプリを初めて起動した際（または再インストール後）に呼び出されます。

1.  **リクエスト**: クライアントは `X-Device-Id` HTTPヘッダーに一意なデバイス識別子を含めてリクエストを送信します。
2.  **サーバー処理 (`ActivateDeviceCommand`)**:
    a.  受け取った `deviceId` を検証します。
    b.  `IDeviceRepository.findByDeviceId` を使用して、この `deviceId` が既に登録されているか確認します。
    c.  **デバイスが存在する場合**: 関連付けられている `userId` を取得します。
    d.  **デバイスが存在しない場合**: `IUserRepository.createAnonymousUser` で新しい匿名ユーザーを作成し、新しい `userId` を取得します。その後、`IDeviceRepository.save` で新しい `UserDevice` レコードを作成して `userId` と `deviceId` を紐付けます。
    e.  決定された `userId` を使用して、`AuthService.issueAuthTokens` を呼び出し、新しいアクセストークン (`user_access`) とリフレッシュトークン (`user_refresh`) を発行します。
    f.  発行されたリフレッシュトークンを `ITokenRepository.saveRefreshToken` でKVストアに `userId` をキーとして保存します。
3.  **レスポンス**: 新しいアクセストークン、リフレッシュトークン、アクセストークンの有効期間 (`expiresIn`) を含むJSONオブジェクトを返します。

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 900
}
```

### 3.2. トークンリフレッシュ (`POST /v1/auth/refresh`)

アクセストークンの有効期限が近づいた、または切れた場合に呼び出されます。

1.  **リクエスト**: クライアントはリクエストボディに有効なリフレッシュトークンを含めて送信します。
    ```json
    { "refresh_token": "eyJ..." }
    ```
2.  **サーバー処理 (`RefreshTokenCommand`)**:
    a.  リクエストボディから `refresh_token` を取得し、バリデーションします。
    b.  `IJwtService.verifyRefreshToken` を使用して、提供されたリフレッシュトークンを検証します。署名、有効期限、ペイロード (`sub`, `type`) を確認します。
    c.  検証でエラーが発生した場合（無効、期限切れなど）は、適切なエラーレスポンス (例: 401 Unauthorized) を返します。
    d.  検証に成功した場合、ペイロードから `userId` を取得します。
    e.  取得した `userId` を使用して、`ITokenRepository.findRefreshTokenByUserId` でKVストアに保存されているリフレッシュトークンを取得します。
    f.  KVストアから取得したトークンが存在しない場合、または提供されたトークンと一致しない場合は、セキュリティリスク（トークン漏洩・無効化）の可能性があるため、エラーレスポンス (401 Unauthorized) を返し、KVストアから該当トークンを削除します (`ITokenRepository.deleteRefreshTokenByUserId`)。
    g.  トークンが一致し有効であれば、`AuthService.issueAuthTokens` を呼び出して新しいアクセストークンとリフレッシュトークンを発行します。
    h.  新しいリフレッシュトークンを `ITokenRepository.saveRefreshToken` でKVストアに保存します (古いものは上書きされます)。
3.  **レスポンス**: 新しいアクセストークン、リフレッシュトークン、アクセストークンの有効期間 (`expiresIn`) を含むJSONオブジェクトを返します。

### 3.3. 保護されたAPIへのアクセス

セッション作成 (`POST /v1/sessions`) など、認証が必要なエンドポイントへのアクセス手順です。

1.  **リクエスト**: クライアントは有効なユーザーアクセストークンを `Authorization: Bearer <accessToken>` ヘッダーに含めてリクエストを送信します。
2.  **サーバー処理 (`jwtAuthMiddleware` + 各ハンドラ)**:
    a.  `hono/jwt` を利用した認証ミドルウェア (`jwtAuthMiddleware`) が `Authorization` ヘッダーからトークンを抽出し、`JWT_SECRET` を使用して署名と有効期限を検証します。
    b.  検証に失敗した場合、ミドルウェアはエラーレスポンス (例: 401 Unauthorized) を返します。
    c.  検証に成功した場合、トークンのペイロードが Hono のコンテキスト `c.get('jwtPayload')` に設定されます。
    d.  後続のHTTPハンドラ (例: `startSessionHttpHandler`) は `c.get('jwtPayload').sub` から `userId` を取得し、リクエストを処理します。
3.  **レスポンス**: APIエンドポイントの処理結果に応じたレスポンスを返します。

### 3.4. Apple ID 連携 (`POST /v1/auth/apple`)

既存の匿名ユーザーアカウント (デバイス認証で作成されたアカウント) にApple IDを紐付けるためのフローです。これにより、アカウントの復元や複数デバイスでの利用が可能になります。これはアプリ内の設定画面などからユーザーが任意で行う操作を想定しています。

1.  **前提**: ユーザーは既にデバイス認証済みであり、有効なユーザーアクセストークン (`user_access`) を持っています。
2.  **クライアント処理**: アプリ内で "Sign in with Apple" フローを実行し、Appleから `identityToken` を取得します。
3.  **リクエスト**: クライアントは取得した `identityToken` をリクエストボディに含め、`Authorization: Bearer <userAccessToken>` ヘッダーと共に `/v1/auth/apple` エンドポイントにPOSTします。
    ```json
    { "identityToken": "eyJ..." }
    ```
4.  **サーバー処理**: (この処理を行うための専用コマンド、例: `LinkAppleIdCommand` を実装する必要があります)
    a.  `Authorization` ヘッダーからユーザーアクセストークンを検証 (`jwtAuthMiddleware` 等) し、`userId` を取得します。
    b.  リクエストボディから `identityToken` を取得し、Appleの公開鍵を使って検証します (署名、有効期限、`aud` クレームなどがアプリの識別子と一致するかなど)。Appleが提供するライブラリや、サードパーティのJWTライブラリを利用します。
    c.  検証に成功したら、`identityToken` のペイロードからAppleユーザー識別子 (通常は `sub` クレーム) を取得します。
    d.  取得した `userId` と `apple_user_identifier` を紐付けます。
        *   **データモデル**: これを実現するには、データベーススキーマの変更が必要です。（詳細は後述の「4. データモデルへの影響」を参照）
        *   データベースに紐付け情報を保存します。この際、他のユーザーが既に同じ `apple_user_identifier` を使用していないか確認する必要があります（一意性制約）。もし使用されていた場合はエラーを返します。
    e.  **トークン発行**: Apple ID連携が成功した後、通常は特別なトークンを再発行する必要はありません。クライアントは既存のアクセストークン/リフレッシュトークンをそのまま使用し続けます。連携成功を示すレスポンスを返します。
5.  **レスポンス**: 連携成功を示すレスポンス (例: 200 OK、または更新されたユーザー情報の一部) を返します。

### 3.5. Apple IDでのサインイン (オプション)

アプリ起動時に、デバイス認証の代わりにApple IDで直接サインイン/サインアップする機能を提供する場合のフローです。

1.  クライアントは "Sign in with Apple" フローを実行し、`identityToken` を取得します。
2.  クライアントは `identityToken` を専用のエンドポイント (例: `POST /v1/auth/apple/signin`) に送信します。
3.  サーバーは `identityToken` を検証し、`apple_user_identifier` (`sub`) を取得します。
4.  サーバーは `apple_user_identifier` を元に、関連付けられた `userId` をデータベースから検索します。（「4. データモデルへの影響」参照）
    a.  **`userId` が見つかった場合 (既存ユーザー)**: その `userId` を使って `AuthService.issueAuthTokens` を呼び出し、新しいトークンセット (`user_access`, `user_refresh`) を発行してクライアントに返します。リフレッシュトークンもKVに保存します。
    b.  **`userId` が見つからない場合 (新規ユーザー)**: 新しい匿名ユーザーを作成 (`IUserRepository.createAnonymousUser`) し、その `userId` と `apple_user_identifier` を紐付けてデータベースに保存します。その後、新しい `userId` を使って `AuthService.issueAuthTokens` を呼び出し、トークンセットを発行してクライアントに返します。

## 4. データモデルへの影響 (Apple ID連携)

Apple ID連携・サインイン機能を実装するには、データベーススキーマの変更が必要です。

*   **案1: `users` テーブルへのカラム追加**: (シンプルだが拡張性は低い)
    *   `users` テーブルに `apple_user_identifier` (VARCHAR, UNIQUE, NULLABLE) のようなカラムを追加します。
*   **案2: 連携テーブルの作成 (推奨)**: (他の認証プロバイダへの拡張性が高い)
    *   `user_external_logins` のような新しいテーブルを作成します。
    *   **カラム例**:
        *   `user_id` (TEXT NOT NULL, FK to users.id)
        *   `provider` (TEXT NOT NULL, 例: 'apple')
        *   `provider_user_id` (TEXT NOT NULL, Appleの`sub`クレーム)
        *   `created_at` (TEXT DEFAULT CURRENT_TIMESTAMP)
    *   `(provider, provider_user_id)` に複合ユニーク制約を設定します。
    *   `(user_id, provider)` に複合ユニーク制約を設定する場合もあります（ユーザーごとに各プロバイダは1つまで）。

**(注意: これらのスキーマ変更は現時点では `schema.ts` に反映されていません。実装する際にはマイグレーションが必要です。)**

## 5. セキュリティに関する考慮事項

*   **HTTPS**: 全ての通信はHTTPS経由で行われる必要があります。
*   **JWTシークレット**: `JWT_SECRET` 環境変数は十分に複雑で、安全に管理される必要があります。
*   **トークン有効期間**: アクセストークンは短命 (15分) に設定し、リフレッシュトークンは比較的長命 (90日) に設定しています。バランスを考慮し、必要に応じて調整します。
*   **リフレッシュトークンの保存**: KVストアに保存されます。KVへのアクセス制御も重要です。
*   **リフレッシュトークン漏洩対策**: 現在の実装では、リフレッシュリクエスト時にKVの値と一致するかを確認しています。より高度な対策として、リフレッシュトークンローテーション (使用時に新しいリフレッシュトークンも発行する) の導入も検討可能です。
*   **レートリミット**: 認証エンドポイント (`/v1/auth/*`) への過剰なリクエストを防ぐため、レートリミットの実装を推奨します。
*   **入力バリデーション**: デバイスIDやリフレッシュトークン、Apple `identityToken` など、クライアントからの入力は常にバリデーションされます。
*   **Apple `identityToken` の検証**: Appleのドキュメントに従い、署名、`nonce` (使用する場合)、`aud`、有効期限などを厳密に検証する必要があります。
*   **ユーザーアカウントの乗っ取り**: 既に存在するアカウントに誤って別のApple IDを紐付けないように、連携フローのユーザー認証 (`Authorization` ヘッダーの検証) を確実に行う必要があります。また、`apple_user_identifier` の一意性をデータベースレベルで保証します。

## 6. 関連コンポーネント

*   **ドメイン層**:
    *   `AuthService` (`src/domain/auth/service.ts`): トークン発行の主要ロジック。
    *   `IJwtService` (`src/domain/auth/service.ts`): JWT操作のインターフェース。
    *   `ITokenRepository` (`src/domain/auth/repository.ts`): リフレッシュトークン永続化のインターフェース。
    *   `IUserRepository`, `IDeviceRepository` (`src/domain/auth/repository.ts`): ユーザー・デバイス情報の永続化インターフェース。
    *   (Apple ID連携用) `IUserExternalLoginRepository` (インターフェース定義が必要)
    *   各種エンティティ (`src/domain/auth/entity.ts`): `User`, `UserDevice`, `AuthToken` など。
    *   値オブジェクト (`src/domain/shared/vo/identifier.ts`): `UserIdVO` など。
*   **アプリケーション層**:
    *   `ActivateDeviceCommand` (`src/app/command/auth/activate-device-command.ts`): デバイスアクティベーションフロー。
    *   `RefreshTokenCommand` (`src/app/command/auth/refresh-token-command.ts`): トークンリフレッシュフロー。
    *   (Apple ID連携用) `LinkAppleIdCommand`, `SignInWithAppleCommand` (コマンド定義が必要)
*   **インフラストラクチャ層**:
    *   `JwtServiceImpl` (`src/infrastructure/auth/jwt-service.ts`): `hono/jwt` を使用した `IJwtService` の実装。
    *   `KvTokenStoreImpl` (`src/infrastructure/kv/token-store.ts`): Cloudflare KV を使用した `ITokenRepository` の実装。
    *   `UserRepositoryImpl`, `DeviceRepositoryImpl` (`src/infrastructure/db/repository/*`): D1 を使用したリポジトリ実装。
    *   (Apple ID連携用) `DrizzleUserExternalLoginRepositoryImpl` (実装が必要)
    *   (Apple ID連携用) Apple `identityToken` 検証サービス (実装が必要)
*   **インターフェース層**:
    *   `jwtAuthMiddleware` (`src/interface/http/router.ts`): `hono/jwt` を利用した認証ミドルウェア。
    *   関連するHonoハンドラ (`src/interface/http/handlers/auth/*`): Apple ID連携用のハンドラも追加が必要。
    *   ルーター (`src/interface/http/router.ts`): DI設定とルーティング定義。
