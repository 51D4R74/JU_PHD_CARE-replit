import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// ── JWT token configuration ───────────────────────────────────────────────
//
// Stateless HS256 tokens stored in an httpOnly cookie.
// Replaces express-session: no server-side store required.
// Official product choice: keep first-party JWT auth for the current product
// phase. Cognito is intentionally out of scope until multi-tenant billing,
// infra boundaries, and external IAM requirements are actually justified.

const JWT_COOKIE = "lumina.token";
const JWT_ALGORITHM = "HS256" as const;
const JWT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface JwtPayload {
  sub: string;  // userId
  role: string; // userRole
  iat: number;
  exp: number;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production. Add it to Secrets Manager.");
  }
  // Dev fallback — logged so developers notice immediately
  console.warn("[auth] JWT_SECRET not set — using insecure dev default. Set JWT_SECRET in .env");
  return "dev-jwt-secret-change-in-production-never-use-this-in-prod";
}

function verifyToken(req: Request): JwtPayload | null {
  const token = (req.cookies as Record<string, unknown>)[JWT_COOKIE];
  if (!token || typeof token !== "string") return null;
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] }) as JwtPayload;
  } catch {
    return null;
  }
}

/** Issue a signed JWT, set as httpOnly cookie on the response. */
export function issueToken(res: Response, userId: string, userRole: string): void {
  const token = jwt.sign(
    { sub: userId, role: userRole },
    getJwtSecret(),
    { expiresIn: "7d", algorithm: JWT_ALGORITHM },
  );
  res.cookie(JWT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: JWT_MAX_AGE_MS,
    path: "/",
  });
}

/** Clear the JWT cookie on logout. */
export function clearToken(res: Response): void {
  res.clearCookie(JWT_COOKIE, { path: "/" });
}

// ── Express augmentation ──────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

// ── Middleware ────────────────────────────────────────────────────────────

/**
 * Reject requests without a valid JWT cookie.
 * Attaches userId and userRole to req for downstream handlers.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const payload = verifyToken(req);
  if (payload) {
    req.userId = payload.sub;
    req.userRole = payload.role;
    return next();
  }
  return res.status(401).json({ message: "Autenticação necessária" });
}

/**
 * Factory: verify the authenticated user owns the resource identified by
 * `paramName` in the URL, OR the user has role `rh` (HR can access any).
 */
export function requireOwner(paramName = "userId") {
  return (req: Request, res: Response, next: NextFunction) => {
    const targetId = req.params[paramName];
    if (req.userRole === "rh" || req.userId === targetId) {
      return next();
    }
    return res.status(403).json({ message: "Acesso não autorizado" });
  };
}

/** Factory: only allow users with a specific role. */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.userRole === role) return next();
    return res.status(403).json({ message: "Acesso não autorizado" });
  };
}
