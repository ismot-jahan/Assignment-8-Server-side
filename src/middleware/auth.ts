import { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const base = (process.env.CLIENT_URL || "http://localhost:3000").split(",")[0].trim().replace(/\/$/, "");
    // Better Auth (running inside the Next.js client) publishes its public keys here.
    jwks = createRemoteJWKSet(new URL(`${base}/api/auth/jwks`));
  }
  return jwks;
}

/** Protects a route: requires `Authorization: Bearer <Better Auth JWT>`. */
export async function verifyJWT(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: please log in first." });
  }
  try {
    const { payload } = await jwtVerify(header.slice(7), getJwks());
    if (!payload.email) throw new Error("Token has no email");
    req.user = {
      id: String(payload.id ?? payload.sub ?? ""),
      email: String(payload.email),
      name: String(payload.name ?? ""),
    };
    next();
  } catch (err) {
    // The JWKS fetch can fail for reasons other than an invalid token (the
    // client being down, a network blip). Log the detail but only ever tell
    // the caller the session is not usable, so we never leak internals.
    console.error("JWT verification failed:", err instanceof Error ? err.message : err);
    return res.status(401).json({ message: "Your session has expired. Please log in again." });
  }
}
