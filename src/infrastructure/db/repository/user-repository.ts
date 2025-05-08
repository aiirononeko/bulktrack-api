import { drizzle } from 'drizzle-orm/d1';
import { v7 as uuidv7 } from 'uuid'; // UUID v7 を生成するためにuuidパッケージを利用
import type { IUserRepository } from '../../../domain/auth/repository';
import type { User, UserId } from '../../../domain/auth/entity';
import { users } from '../schema'; // D1スキーマ
import { eq } from 'drizzle-orm';

export class UserRepositoryImpl implements IUserRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async createAnonymousUser(initialDisplayName: string): Promise<User> {
    const newUserId = uuidv7() as UserId; // UUID v7を生成し、UserId型にキャスト
    const newUser: User = {
      id: newUserId,
      displayName: initialDisplayName,
      // createdAt はスキーマのデフォルトで設定される
    };

    await this.db.insert(users).values({
      id: newUser.id,
      displayName: newUser.displayName,
      // goalJson は nullable なので省略
    });

    // DrizzleのreturningがD1で完全サポートされていない場合があるため、
    // 挿入したデータを再度取得するか、挿入に使ったデータを返す
    // ここでは挿入に使ったデータを返す (created_atはDB側で設定される点に注意)
    return newUser;
  }

  async findById(userId: UserId): Promise<User | null> {
    const result = await this.db
      .select({
        id: users.id,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }
    // schema.tsのusers.idはtext()なのでstring。UserId型に合わせる必要がある場合、キャストやバリデーションを検討。
    // ここでは UserId と string が互換であると仮定（実際はvalibotの型なので厳密には異なる）
    return { id: result[0].id as UserId, displayName: result[0].displayName };
  }
} 