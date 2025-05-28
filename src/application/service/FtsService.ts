// D1データベース用の型をインポート
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { toHiragana } from "wanakana";
import * as schema from "../../infrastructure/db/schema";

// DrizzleのDBインスタンスの型を DrizzleD1Database に変更
type DrizzleDBInstance = DrizzleD1Database<typeof schema>;

// スキーマから推論される型エイリアス
type ExerciseSelect = typeof schema.exercises.$inferSelect;
type ExerciseTranslationSelect =
  typeof schema.exerciseTranslations.$inferSelect;

// トランザクションスコープの型を正しく取得するために、
// db.transactionのコールバック関数の引数の型を取得します。
// Drizzleのバージョンや具体的なデータベースドライバによって微妙に型が異なる場合があるため、
// Parameters<T> を使って動的に取得するのが堅牢です。
// ただし、DrizzleDBInstance['transaction'] が正しく解決される必要があります。
// ここでは、一旦 TransactionScope の型を tx: any として進め、後ほど調整する可能性も残します。
// より正確には、Drizzle の Transaction 関数の型シグネチャを参照すべきです。
// type DrizzleTransactionCallback = Parameters<DrizzleDBInstance['transaction']>[0];
// type DrizzleTransactionScope = Parameters<DrizzleTransactionCallback>[0];
// 上記が複雑なため、Drizzleのドキュメントや実際のdbインスタンスから型を特定することを推奨。
// 一旦、txの型は Drizzle の標準的なトランザクション型を想定します。
// (例: SQLiteTransaction<typeof schema, any, any, any> など。正確な型は要確認)
// もっともシンプルなのは tx: any ですが、型安全性を損ないます。
// ここでは tx: DrizzleDBInstance と同等か、それのトランザクション用派生型を期待します。
// Drizzle の標準的なトランザクション型は DrizzleTransactionAsync です。

export class FtsService {
  private db: DrizzleDBInstance;

  constructor(db: DrizzleDBInstance) {
    this.db = db;
  }

  async populateFtsTable(): Promise<{ count: number; message: string }> {
    console.log(
      "Fetching exercises and translations using Drizzle for FTS population...",
    );
    const allExercises: ExerciseSelect[] = await this.db
      .select()
      .from(schema.exercises);
    const allTranslations: ExerciseTranslationSelect[] = await this.db
      .select()
      .from(schema.exerciseTranslations);

    const ftsEntries: Array<typeof schema.exercisesFts.$inferInsert> = [];

    console.log("Normalizing and preparing FTS data with Drizzle...");

    for (const trans of allTranslations) {
      const exercise = allExercises.find(
        (e: ExerciseSelect) => e.id === trans.exerciseId,
      );
      if (!exercise || !exercise.canonicalName) continue;

      const originalText = [exercise.canonicalName, trans.name, trans.aliases]
        .filter(Boolean)
        .join(" ");

      const normalizedText = toHiragana(originalText, {
        passRomaji: true,
      }).toLowerCase();

      ftsEntries.push({
        exerciseId: trans.exerciseId,
        locale: trans.locale,
        text: originalText,
        textNormalized: normalizedText,
      });
    }

    for (const ex of allExercises) {
      if (!ex.canonicalName) continue;
      const hasTranslation = allTranslations.some(
        (t: ExerciseTranslationSelect) => t.exerciseId === ex.id,
      );
      if (hasTranslation) continue;

      const originalText = ex.canonicalName;
      const normalizedText = toHiragana(originalText, {
        passRomaji: true,
      }).toLowerCase();

      ftsEntries.push({
        exerciseId: ex.id,
        locale: "unknown",
        text: originalText,
        textNormalized: normalizedText,
      });
    }

    console.log(`Prepared ${ftsEntries.length} FTS entries for Drizzle.`);

    if (ftsEntries.length === 0) {
      const message = "No data to insert into FTS table.";
      console.log(message);
      return { count: 0, message };
    }

    // D1のバッチ処理を使用するように変更
    try {
      const statements = [];
      // DELETE文を statements 配列に追加
      statements.push(this.db.delete(schema.exercisesFts));

      for (const entry of ftsEntries) {
        // INSERT文を statements 配列に追加
        statements.push(this.db.insert(schema.exercisesFts).values(entry));
      }

      console.log(
        `Executing batch of ${statements.length} statements on D1...`,
      );
      await this.db.batch(statements as any);

      const message = `Successfully populated exercises_fts table with ${ftsEntries.length} entries using batch operation.`;
      console.log(message);
      return { count: ftsEntries.length, message };
    } catch (error) {
      console.error(
        "Error during D1 batch operation for FTS population:",
        error,
      );
      throw error;
    }
  }
}
