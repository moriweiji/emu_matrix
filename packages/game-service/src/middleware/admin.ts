import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createErrorResponse, HTTP_STATUS } from '@emu-matrix/shared';
import { query } from '../database';

export interface AdminRequest extends Request {
  userId?: string;
  userRole?: string;
}

export async function adminMiddleware(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(createErrorResponse('UNAUTHORIZED', 'Missing or invalid authorization header'));
    return;
  }

  const token = authHeader.substring(7);
  let decoded: { userId: string };
  try {
    const secret = process.env.JWT_ACCESS_SECRET || 'default-access-secret';
    decoded = jwt.verify(token, secret) as { userId: string };
  } catch {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(createErrorResponse('TOKEN_EXPIRED', 'Access token is expired or invalid'));
    return;
  }

  try {
    const result = await query('SELECT role FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(createErrorResponse('UNAUTHORIZED', 'User not found'));
      return;
    }

    if (result.rows[0].role !== 'admin') {
      res.status(HTTP_STATUS.FORBIDDEN).json(createErrorResponse('FORBIDDEN', 'Admin access required'));
      return;
    }

    req.userId = decoded.userId;
    req.userRole = result.rows[0].role;
    next();
  } catch {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json(createErrorResponse('INTERNAL_ERROR', 'Failed to verify admin status'));
  }
}
