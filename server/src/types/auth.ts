import type { UserResponse } from "./user";

export type AccessTokenPayload = {
  userId: string;
  email: string;
  type: "access";
};

export type RefreshTokenPayload = {
  userId: string;
  sessionId: string;
  type: "refresh";
};

export type AuthSuccessResponse = {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
};

export type RefreshTokenResponse = {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
};
