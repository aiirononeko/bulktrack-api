import {
  type InferOutput,
  nonEmpty,
  number,
  object,
  pipe,
  string,
} from "valibot";

export const AuthTokensDTOSchema = object({
  accessToken: pipe(string(), nonEmpty("Access token cannot be empty.")),
  refreshToken: pipe(string(), nonEmpty("Refresh token cannot be empty.")),
  expiresIn: number(), // Access token TTL in seconds
});

export type AuthTokensDTO = InferOutput<typeof AuthTokensDTOSchema>;
