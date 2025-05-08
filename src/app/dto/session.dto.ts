export interface StartSessionRequestDto {
  menuId?: string | null; // userId は認証情報から取得
}

// レスポンス用のDTOもここに定義可能
export interface StartSessionResponseDto {
  sessionId: string;
  startedAt: string; // ISO 8601形式の文字列など
}

export interface FinishSessionResponseDto {
  sessionId: string;
  finishedAt: string; // ISO 8601形式の文字列
}
