import type { Request, Response, NextFunction } from "express";

// Augment express-session to include our custom fields
declare module "express-session" {
  interface SessionData {
    userId: string;
    userRole: string;
  }
}

// Augment Express Request with authenticated user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

/**
 * Reject requests without a valid session.
 * Attaches userId and userRole to req for downstream handlers.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    req.userId = req.session.userId;
    req.userRole = req.session.userRole;
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
