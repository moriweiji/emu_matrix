import * as fs from 'fs';
import * as path from 'path';

const STORAGE_PATH = process.env.STORAGE_PATH || '/data/storage';

export { STORAGE_PATH };

export async function ensureBucket(): Promise<void> {
  try {
    await fs.promises.mkdir(STORAGE_PATH, { recursive: true });
    console.log(`[storage] Storage directory ensured: ${STORAGE_PATH}`);
  } catch (error) {
    console.error('[storage] Failed to create storage directory:', error);
    throw error;
  }
}

export async function uploadObject(objectName: string, data: Buffer, contentType?: string): Promise<string> {
  const fullPath = path.join(STORAGE_PATH, objectName);
  const dir = path.dirname(fullPath);

  try {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, data);
    console.log(`[storage] Uploaded: ${objectName} (${data.length} bytes)`);
    return `/${objectName}`;
  } catch (error) {
    console.error(`[storage] Failed to upload ${objectName}:`, error);
    throw error;
  }
}

export async function deleteObject(objectName: string): Promise<void> {
  const fullPath = path.join(STORAGE_PATH, objectName);

  try {
    await fs.promises.access(fullPath, fs.constants.F_OK);
    await fs.promises.unlink(fullPath);
    console.log(`[storage] Deleted: ${objectName}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`[storage] File not found, skipping delete: ${objectName}`);
      return;
    }
    console.error(`[storage] Failed to delete ${objectName}:`, error);
    throw error;
  }
}

export function getObjectUrl(objectName: string): string {
  const baseUrl = process.env.MEDIA_BASE_URL || '/media';
  return `${baseUrl}/${objectName}`;
}

export async function objectExists(objectName: string): Promise<boolean> {
  const fullPath = path.join(STORAGE_PATH, objectName);
  try {
    await fs.promises.access(fullPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function getObjectSize(objectName: string): Promise<number> {
  const fullPath = path.join(STORAGE_PATH, objectName);
  try {
    const stat = await fs.promises.stat(fullPath);
    return stat.size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`File not found: ${objectName}`);
    }
    throw error;
  }
}

export function resolveFilePath(objectName: string): string {
  return path.join(STORAGE_PATH, objectName);
}
