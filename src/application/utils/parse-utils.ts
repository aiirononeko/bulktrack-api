/**
 * 文字列を整数にパースし、失敗した場合はデフォルト値を返す
 * @param value パースする文字列
 * @param defaultValue デフォルト値
 * @returns パースされた整数またはデフォルト値
 */
export function parseIntWithDefault(
  value: string | undefined,
  defaultValue: number,
): number {
  if (!value) return defaultValue;

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 文字列を浮動小数点数にパースし、失敗した場合はデフォルト値を返す
 * @param value パースする文字列
 * @param defaultValue デフォルト値
 * @returns パースされた数値またはデフォルト値
 */
export function parseFloatWithDefault(
  value: string | undefined,
  defaultValue: number,
): number {
  if (!value) return defaultValue;

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}
