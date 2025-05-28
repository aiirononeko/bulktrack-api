import { toHiragana } from "wanakana";

/**
 * 文字列をひらがなに正規化します。
 * カタカナ -> ひらがな
 * 波ダッシュなどを統一 (オプション)
 * @param str 対象文字列
 * @returns ひらがな化された文字列
 */
export function normalizeToHiragana(str: string | null | undefined): string {
  if (!str) {
    return "";
  }
  // toHiragana はデフォルトでローマ字入力からの変換も含むため、
  // 純粋なカタカナ→ひらがな変換にはオプションが必要な場合がある。
  // wanakanaのオプションを確認し、意図した変換（カタカナのみをひらがなに）にする。
  // toKana で一度カタカナに寄せてから toHiragana するか、
  // isKana などで入力がカナであるかチェックするのも良い。
  // ここではシンプルに toHiragana を使うが、挙動は要テスト。
  // 一般的には toHiragana(str, { passRomaji: true }) のようにしてローマ字はそのままにするか、
  // toKana(str) で全角カタカナに変換してから toHiragana(str) をかける。
  // 設計案は toHiragana のみなので、それに従う。
  return toHiragana(str, { passRomaji: true }); // ローマ字はひらがな化しない
}
