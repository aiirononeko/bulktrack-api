import { object, string, number, type InferOutput, pipe, nonEmpty } from 'valibot';

export const AuthTokensDTOSchema = object({
  accessToken: pipe(string(), nonEmpty('Access token cannot be empty.')),
  refreshToken: pipe(string(), nonEmpty('Refresh token cannot be empty.')),
  expiresIn: number(), // Access token TTL in seconds
});

export type AuthTokensDTO = InferOutput<typeof AuthTokensDTOSchema>;
