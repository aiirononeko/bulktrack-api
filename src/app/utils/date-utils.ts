/**
 * Dateオブジェクトまたは日付文字列から、ISO 8601 週番号に基づいた
 * 'YYYY-WW' 形式の週識別子を生成します。
 * 例: 2023-01-01 -> "2023-W01" (実際にはその週の開始日によって異なる)
 *     2023-12-31 -> "2023-W52"
 * @param dateInput Dateオブジェクトまたはパース可能な日付文字列
 * @returns 'YYYY-WW' 形式の週識別子
 */
export function getISOWeekIdentifier(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

  // 木曜日をその週の代表日とする (ISO 8601定義)
  const thursday = new Date(date.valueOf());
  thursday.setDate(date.getDate() - ((date.getDay() + 6) % 7) + 3); // date.getDay() 日曜=0, 月曜=1... 土曜=6

  const year = thursday.getFullYear();

  // その年の1月1日の木曜日を含む週がW01
  const firstThursday = new Date(thursday.valueOf());
  firstThursday.setMonth(0, 1); // 今年の1月1日
  firstThursday.setDate(1 - ((firstThursday.getDay() + 6) % 7) + 3);

  // 週番号を計算
  const weekNumber =
    Math.round((thursday.valueOf() - firstThursday.valueOf()) / 86400000 / 7) +
    1;

  return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
}

/**
 * Dateオブジェクトまたは日付文字列から、その日が含まれるISO週の月曜日の日付を
 * 'YYYY-MM-DD' 形式の文字列で返します。
 * @param dateInput Dateオブジェクトまたはパース可能な日付文字列
 * @returns 'YYYY-MM-DD' 形式の月曜日の日付文字列
 */
export function getISOWeekMondayString(dateInput: Date | string): string {
  const date =
    typeof dateInput === "string"
      ? new Date(dateInput)
      : new Date(dateInput.getTime()); // Clone if Date object
  const dayOfWeek = date.getUTCDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6 (UTC to be consistent with ISO weeks)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Number of days to subtract to get to Monday

  const monday = new Date(date.valueOf()); // Corrected: Use valueOf() or getTime() to get timestamp
  monday.setUTCDate(date.getUTCDate() + diffToMonday);

  // Format to YYYY-MM-DD
  const year = monday.getUTCFullYear();
  const month = (monday.getUTCMonth() + 1).toString().padStart(2, "0");
  const Mday = monday.getUTCDate().toString().padStart(2, "0");

  return `${year}-${month}-${Mday}`;
}

/**
 * Dateオブジェクトまたは日付文字列から、その日が含まれるISO週の日曜日の日付を
 * 'YYYY-MM-DD' 形式の文字列で返します。
 * @param dateInput Dateオブジェクトまたはパース可能な日付文字列
 * @returns 'YYYY-MM-DD' 形式の日曜日の日付文字列
 */
export function getISOWeekSundayString(dateInput: Date | string): string {
  const mondayString = getISOWeekMondayString(dateInput);
  const monday = new Date(`${mondayString}T00:00:00Z`); // Ensure parsing as UTC date

  const sunday = new Date(monday.valueOf());
  sunday.setUTCDate(monday.getUTCDate() + 6);

  // Format to YYYY-MM-DD
  const year = sunday.getUTCFullYear();
  const month = (sunday.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = sunday.getUTCDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * 指定されたspan（例: "4w"）に基づいて、現在の週を基準とした週次日付範囲を生成します。
 * 各週は月曜日を開始日とし、YYYY-MM-DD形式の文字列のリストを返します。
 * @param span 期間指定文字列（例: "1w", "4w", "12w"）
 * @returns 週開始日のリスト（古い順にソート）
 */
export function generateWeeklyDateRange(span: string): string[] {
  const now = new Date();
  const currentWeekMonday = getISOWeekMondayString(now);

  let weeksCount = 1; // デフォルトは1週間
  const spanMatch = /(\d+)w/.exec(span);
  if (spanMatch?.[1]) {
    weeksCount = Number.parseInt(spanMatch[1], 10);
  }

  const weekStartDates: string[] = [];

  for (let i = 0; i < weeksCount; i++) {
    const currentMondayDate = new Date(`${currentWeekMonday}T00:00:00Z`);
    currentMondayDate.setUTCDate(currentMondayDate.getUTCDate() - i * 7);

    const weekStartString = getISOWeekMondayString(currentMondayDate);
    weekStartDates.push(weekStartString);
  }

  // 古い順にソート
  return weekStartDates.sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );
}
