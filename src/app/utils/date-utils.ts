/**
 * Dateオブジェクトまたは日付文字列から、ISO 8601 週番号に基づいた
 * 'YYYY-WW' 形式の週識別子を生成します。
 * 例: 2023-01-01 -> "2023-W01" (実際にはその週の開始日によって異なる)
 *     2023-12-31 -> "2023-W52"
 * @param dateInput Dateオブジェクトまたはパース可能な日付文字列
 * @returns 'YYYY-WW' 形式の週識別子
 */
export function getISOWeekIdentifier(dateInput: Date | string): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

    // 木曜日をその週の代表日とする (ISO 8601定義)
    const thursday = new Date(date.valueOf());
    thursday.setDate(date.getDate() - ((date.getDay() + 6) % 7) + 3); // date.getDay() 日曜=0, 月曜=1... 土曜=6

    const year = thursday.getFullYear();

    // その年の1月1日の木曜日を含む週がW01
    const firstThursday = new Date(thursday.valueOf());
    firstThursday.setMonth(0, 1); // 今年の1月1日
    firstThursday.setDate(1 - ((firstThursday.getDay() + 6) % 7) + 3);

    // 週番号を計算
    const weekNumber = Math.round(((thursday.valueOf() - firstThursday.valueOf()) / 86400000) / 7) + 1;

    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}
  