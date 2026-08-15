import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';

// Secure JWT Secret handling with resilient fallback
function getJwtSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16) {
    return process.env.JWT_SECRET.trim();
  }

  // Generate a cryptographically strong 256-bit runtime secret when not configured
  console.warn('⚠️ [SECURITY NOTICE] JWT_SECRET not provided or too short in environment. Using generated secure runtime secret.');
  return crypto.randomBytes(32).toString('hex');
}

const JWT_SECRET = getJwtSecret();

// Helper to hash token string for fast O(1) database/memory lookup
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export interface AdminPayload {
  id: number;
  email: string;
  username?: string;
  role?: 'developer' | 'owner' | 'admin';
  mustChangePassword?: boolean;
  jti?: string;
  exp?: number;
  iat?: number;
}

export interface AuthenticatedRequest extends Request {
  adminUser?: AdminPayload;
  token?: string;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

// Generate standard 30-minute Access Token with unique JTI and mandatory password reset flag
export function generateToken(payload: AdminPayload): string {
  const jti = payload.jti || crypto.randomUUID();
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      username: payload.username,
      role: payload.role,
      mustChangePassword: Boolean(payload.mustChangePassword),
      jti,
    },
    JWT_SECRET,
    { expiresIn: '30m' }
  );
}

// Verify Token strictly (Signature and Expiry)
export function verifyToken(token: string): AdminPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminPayload;
  } catch {
    return null;
  }
}

// Revoke a specific token immediately (Blacklist in DB and memory)
export async function revokeToken(token: string, userId?: number): Promise<void> {
  const decoded = jwt.decode(token) as AdminPayload | null;
  const tokenHash = hashToken(token);
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 30 * 60 * 1000);
  await db.addRevokedToken(tokenHash, userId || decoded?.id, expiresAt);
}

// Check if a token has been revoked with Fail-Closed security model
export async function isTokenRevoked(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  return await db.isTokenRevoked(tokenHash);
}

// Strict Authorization Bearer Header Middleware (with fail-closed token revocation & must-change-password enforcement)
export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'ያልተፈቀደ መግቢያ! እባክዎ በ Authorization Bearer Header በኩል ይግቡ (Unauthorized: Missing or invalid Bearer token)',
    });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'ያልተፈቀደ መግቢያ! (Unauthorized: Empty Bearer token)' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      error: 'ያለፈበት ወይም የተሳሳተ ቶከን! እባክዎ እንደገና ይግቡ (Invalid or Expired Token)',
    });
  }

  // Check if token has been revoked / logged out (Fail-Closed)
  try {
    const revoked = await isTokenRevoked(token);
    if (revoked) {
      return res.status(401).json({
        error: 'ቶከኑ ተዘግቷል ወይም ተሰርዟል! እባክዎ እንደገና ይግቡ (Token has been revoked/logged out)',
      });
    }
  } catch (err) {
    console.error('CRITICAL: Token revocation verification failed. Failing closed to protect session integrity:', err);
    return res.status(401).json({
      error: 'የሴሽን ደህንነት ማረጋገጥ አልተቻለም፤ እባክዎ እንደገና ይግቡ (Session verification failed - Fail-Closed)',
    });
  }

  req.adminUser = decoded;
  req.token = token;

  // STRICT SERVER-SIDE ENFORCEMENT:
  // If the admin user has mustChangePassword flag, prohibit all endpoints EXCEPT change-password, me, and logout
  if (decoded.mustChangePassword) {
    const requestPath = req.baseUrl ? req.baseUrl + req.path : req.path;
    const isAllowed =
      requestPath.includes('/api/admin/change-password') ||
      requestPath.includes('/api/admin/me') ||
      requestPath.includes('/api/admin/logout');

    if (!isAllowed) {
      return res.status(403).json({
        error: 'PASSWORD_CHANGE_REQUIRED',
        message: 'ወደ ሲስተሙ ከመግባትዎ በፊት የመጀመሪያ ጊዜ ፓስወርድዎን መቀየር ግዴታ ነው! (Default password must be changed before accessing admin services)',
      });
    }
  }

  next();
}

// Role-Based Access Control (RBAC) Middleware
export function requireRole(...allowedRoles: ('developer' | 'owner' | 'admin')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.adminUser) {
      return res.status(401).json({ error: 'ያልተፈቀደ መግቢያ! እባክዎ አስቀድመው ይግቡ (Unauthorized)' });
    }

    const userRole = req.adminUser.role || 'admin';
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: `ለዚህ ተግባር በቂ ፈቃድ የለዎትም (Forbidden: Requires ${allowedRoles.join(' or ')} permission)`,
      });
    }

    next();
  };
}

