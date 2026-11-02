import type { AccessTokenPayload } from "../../types/auth";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export {};
