import type { Context } from "hono";
import type { FtsService } from "../../../../infrastructure/service/fts-service";
import type { AppEnv } from "../../main.router";

export const populateFtsHandler = async (c: Context<AppEnv>) => {
  console.log("Entered /fts/populate POST handler");
  try {
    // FtsServiceインスタンスをコンテキストから取得 (DIミドルウェアでセットアップ想定)
    // AppEnvのVariablesにftsServiceが定義されている必要があります
    const ftsService = c.get("ftsService") as FtsService | undefined;

    if (!ftsService) {
      console.error("FtsService not found in context");
      return c.json({ error: "FtsService not configured" }, 500);
    }

    console.log("Starting FTS population via API endpoint...");
    const result = await ftsService.populateFtsTable();
    console.log("FTS population finished.", result);

    return c.json(result, 200);
  } catch (error: unknown) {
    console.error("Error during FTS population via API:", error);
    let errorMessage = "Failed to populate FTS table";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return c.json(
      { error: "Failed to populate FTS table", details: errorMessage },
      500,
    );
  }
};
