import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import * as fs from 'fs';
import { query } from '../database';
import { adminMiddleware, AdminRequest } from '../middleware/admin';
import { createApiResponse, createErrorResponse, HTTP_STATUS, PLATFORM_ROM_EXTENSIONS, VALID_PLATFORMS, GAME_CATEGORIES, type Platform } from '@emu-matrix/shared';

const STORAGE_PATH = process.env.STORAGE_PATH || './data/storage';

async function uploadFile(objectName: string, data: Buffer): Promise<string> {
  const fullPath = path.join(STORAGE_PATH, objectName);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, data);
  return `/${objectName}`;
}

async function logAudit(operatorId: string, operatorName: string, action: string, targetType: string, targetId: string | null, detail: object | null, ipAddress: string | null) {
  await query(
    'INSERT INTO admin_audit_logs (operator_id, operator_name, action, target_type, target_id, detail, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [operatorId, operatorName, action, targetType, targetId, detail ? JSON.stringify(detail) : null, ipAddress]
  );
}

async function getOperatorName(operatorId: string): Promise<string> {
  const result = await query('SELECT username FROM users WHERE id = $1', [operatorId]);
  return result.rows[0]?.username || 'unknown';
}

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

router.use(adminMiddleware);

router.post('/roms', upload.fields([{ name: 'rom', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req: AdminRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const romFile = files?.rom?.[0];
    const coverFile = files?.cover?.[0];

    if (!romFile) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('VALIDATION_ERROR', 'ROM file is required'));
      return;
    }

    const { name, platform, emulator_core, category, tags, description, release_year, publisher, version, device_model, name_en } = req.body;

    if (!name) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('VALIDATION_ERROR', 'name is required'));
      return;
    }

    if (!platform) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('VALIDATION_ERROR', 'platform is required'));
      return;
    }

    if (!VALID_PLATFORMS.includes(platform)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('VALIDATION_ERROR', `platform must be one of: ${VALID_PLATFORMS.join(', ')}`));
      return;
    }

    const allowedExtensions = PLATFORM_ROM_EXTENSIONS[platform as Platform] || [];
    const romExt = path.extname(romFile.originalname).toLowerCase().replace('.', '');
    if (!allowedExtensions.includes(romExt)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('VALIDATION_ERROR', `ROM extension .${romExt} is not valid for platform ${platform}. Allowed: ${allowedExtensions.join(', ')}`));
      return;
    }

    if (coverFile) {
      const coverExt = path.extname(coverFile.originalname).toLowerCase().replace('.', '');
      if (!['jpg', 'jpeg', 'png'].includes(coverExt)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('VALIDATION_ERROR', 'Cover image must be jpg or png'));
        return;
      }
    }

    if (category && !GAME_CATEGORIES.includes(category)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('VALIDATION_ERROR', `category must be one of: ${GAME_CATEGORIES.join(', ')}`));
      return;
    }

    const romUuid = crypto.randomUUID();
    const romUrl = await uploadFile(`media/roms/${platform}/${romUuid}.${romExt}`, romFile.buffer);

    let coverUrl: string | null = null;
    if (coverFile) {
      const coverExt = path.extname(coverFile.originalname).toLowerCase().replace('.', '');
      const coverUuid = crypto.randomUUID();
      coverUrl = await uploadFile(`media/covers/${platform}/${coverUuid}.${coverExt}`, coverFile.buffer);
    }

    const romSize = romFile.buffer.length;
    const romMd5 = crypto.createHash('md5').update(romFile.buffer).digest('hex');

    const result = await query(
      `INSERT INTO games (name, name_en, platform, emulator_core, category, tags, description, release_year, publisher, version, device_model, rom_url, cover_url, rom_size, rom_md5, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active')
       RETURNING *`,
      [name, name_en || null, platform, emulator_core || null, category || null, tags || null, description || null, release_year || null, publisher || null, version || null, device_model || null, romUrl, coverUrl, romSize, romMd5]
    );

    const game = result.rows[0];

    const operatorName = await getOperatorName(req.userId!);
    await logAudit(req.userId!, operatorName, 'CREATE_ROM', 'game', game.id, { name, platform }, req.ip ?? null);

    res.status(HTTP_STATUS.CREATED).json(createApiResponse(game));
  } catch (error) {
    console.error('Error uploading ROM:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json(createErrorResponse('INTERNAL_ERROR', 'Failed to upload ROM'));
  }
});

router.get('/roms', async (req: AdminRequest, res: Response) => {
  try {
    let page = parseInt(req.query.page as string) || 1;
    let pageSize = parseInt(req.query.pageSize as string) || 20;
    if (![10, 20, 50].includes(pageSize)) pageSize = 20;
    if (page < 1) page = 1;

    const { search, platform, status, isDeleted, startDate, endDate } = req.query;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR name_en ILIKE $${paramIndex} OR version ILIKE $${paramIndex} OR device_model ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (platform) {
      conditions.push(`platform = $${paramIndex}`);
      params.push(platform);
      paramIndex++;
    }

    if (status && status !== 'all') {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (isDeleted && isDeleted !== 'all') {
      conditions.push(`is_deleted = $${paramIndex}`);
      params.push(isDeleted === 'true');
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(`SELECT COUNT(*) as total FROM games ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].total);

    const offset = (page - 1) * pageSize;
    const result = await query(
      `SELECT * FROM games ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    res.json(createApiResponse({
      items: result.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }));
  } catch (error) {
    console.error('Error listing ROMs:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json(createErrorResponse('INTERNAL_ERROR', 'Failed to list ROMs'));
  }
});

router.get('/roms/:id', async (req: AdminRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM games WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json(createErrorResponse('NOT_FOUND', 'ROM not found'));
      return;
    }

    res.json(createApiResponse(result.rows[0]));
  } catch (error) {
    console.error('Error getting ROM:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json(createErrorResponse('INTERNAL_ERROR', 'Failed to get ROM'));
  }
});

router.put('/roms/:id', async (req: AdminRequest, res: Response) => {
  try {
    const existing = await query('SELECT * FROM games WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json(createErrorResponse('NOT_FOUND', 'ROM not found'));
      return;
    }

    const { name, name_en, platform, emulator_core, category, tags, description, release_year, publisher, version, device_model, cover_url } = req.body;

    if (platform && !VALID_PLATFORMS.includes(platform)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('VALIDATION_ERROR', `platform must be one of: ${VALID_PLATFORMS.join(', ')}`));
      return;
    }

    if (category && !GAME_CATEGORIES.includes(category)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('VALIDATION_ERROR', `category must be one of: ${GAME_CATEGORIES.join(', ')}`));
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fields: Record<string, unknown> = { name, name_en, platform, emulator_core, category, tags, description, release_year, publisher, version, device_model, cover_url };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('VALIDATION_ERROR', 'No fields to update'));
      return;
    }

    updates.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await query(
      `UPDATE games SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    const operatorName = await getOperatorName(req.userId!);
    await logAudit(req.userId!, operatorName, 'UPDATE_ROM', 'game', req.params.id, { updates: Object.keys(fields).filter(k => fields[k] !== undefined) }, req.ip ?? null);

    res.json(createApiResponse(result.rows[0]));
  } catch (error) {
    console.error('Error updating ROM:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json(createErrorResponse('INTERNAL_ERROR', 'Failed to update ROM'));
  }
});

router.patch('/roms/:id/status', async (req: AdminRequest, res: Response) => {
  try {
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('VALIDATION_ERROR', 'status must be active or inactive'));
      return;
    }

    const existing = await query('SELECT * FROM games WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json(createErrorResponse('NOT_FOUND', 'ROM not found'));
      return;
    }

    const result = await query(
      'UPDATE games SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    const operatorName = await getOperatorName(req.userId!);
    await logAudit(req.userId!, operatorName, 'TOGGLE_ROM_STATUS', 'game', req.params.id, { status }, req.ip ?? null);

    res.json(createApiResponse(result.rows[0]));
  } catch (error) {
    console.error('Error toggling ROM status:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json(createErrorResponse('INTERNAL_ERROR', 'Failed to toggle ROM status'));
  }
});

router.delete('/roms/:id', async (req: AdminRequest, res: Response) => {
  try {
    const existing = await query('SELECT * FROM games WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json(createErrorResponse('NOT_FOUND', 'ROM not found'));
      return;
    }

    await query(
      'UPDATE games SET is_deleted = true, status = $1, updated_at = NOW() WHERE id = $2',
      ['inactive', req.params.id]
    );

    const operatorName = await getOperatorName(req.userId!);
    await logAudit(req.userId!, operatorName, 'DELETE_ROM', 'game', req.params.id, { name: existing.rows[0].name }, req.ip ?? null);

    res.json(createApiResponse(null, 'ROM deleted successfully'));
  } catch (error) {
    console.error('Error deleting ROM:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json(createErrorResponse('INTERNAL_ERROR', 'Failed to delete ROM'));
  }
});

router.post('/roms/batch-delete', async (req: AdminRequest, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('VALIDATION_ERROR', 'ids must be a non-empty array'));
      return;
    }

    await query(
      'UPDATE games SET is_deleted = true, status = $1, updated_at = NOW() WHERE id = ANY($2)',
      ['inactive', ids]
    );

    const operatorName = await getOperatorName(req.userId!);
    await logAudit(req.userId!, operatorName, 'BATCH_DELETE_ROMS', 'game', null, { ids }, req.ip ?? null);

    res.json(createApiResponse(null, `${ids.length} ROMs deleted successfully`));
  } catch (error) {
    console.error('Error batch deleting ROMs:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json(createErrorResponse('INTERNAL_ERROR', 'Failed to batch delete ROMs'));
  }
});

router.get('/audit-logs', async (req: AdminRequest, res: Response) => {
  try {
    let page = parseInt(req.query.page as string) || 1;
    let pageSize = parseInt(req.query.pageSize as string) || 20;
    if (![10, 20, 50].includes(pageSize)) pageSize = 20;
    if (page < 1) page = 1;

    const { action, targetType, operatorId, startDate, endDate } = req.query;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (action) {
      conditions.push(`action = $${paramIndex}`);
      params.push(action);
      paramIndex++;
    }

    if (targetType) {
      conditions.push(`target_type = $${paramIndex}`);
      params.push(targetType);
      paramIndex++;
    }

    if (operatorId) {
      conditions.push(`operator_id = $${paramIndex}`);
      params.push(operatorId);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(`SELECT COUNT(*) as total FROM admin_audit_logs ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].total);

    const offset = (page - 1) * pageSize;
    const result = await query(
      `SELECT * FROM admin_audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    res.json(createApiResponse({
      items: result.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }));
  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json(createErrorResponse('INTERNAL_ERROR', 'Failed to get audit logs'));
  }
});

export default router;
