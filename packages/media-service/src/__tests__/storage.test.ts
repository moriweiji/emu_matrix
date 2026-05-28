import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ensureBucket,
  uploadObject,
  deleteObject,
  getObjectUrl,
  objectExists,
  getObjectSize,
  resolveFilePath,
  STORAGE_PATH,
} from '../storage';

let testDir: string;
const originalStoragePath = process.env.STORAGE_PATH;

beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emu-matrix-storage-test-'));
  process.env.STORAGE_PATH = testDir;
});

afterAll(() => {
  process.env.STORAGE_PATH = originalStoragePath;
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('ensureBucket', () => {
  it('should create storage directory if not exists', async () => {
    const newDir = path.join(testDir, 'ensure-test');
    process.env.STORAGE_PATH = newDir;
    await ensureBucket();
    expect(fs.existsSync(newDir)).toBe(true);
    process.env.STORAGE_PATH = testDir;
  });

  it('should not throw if directory already exists', async () => {
    await expect(ensureBucket()).resolves.not.toThrow();
  });
});

describe('uploadObject', () => {
  it('should write file to storage and return path', async () => {
    const data = Buffer.from('hello world');
    const result = await uploadObject('test/file.txt', data);
    expect(result).toBe('/test/file.txt');
    const fullPath = path.join(testDir, 'test', 'file.txt');
    expect(fs.existsSync(fullPath)).toBe(true);
    expect(fs.readFileSync(fullPath).toString()).toBe('hello world');
  });

  it('should create nested directories automatically', async () => {
    const data = Buffer.from('nested');
    const result = await uploadObject('a/b/c/deep.txt', data);
    expect(result).toBe('/a/b/c/deep.txt');
    expect(fs.existsSync(path.join(testDir, 'a', 'b', 'c', 'deep.txt'))).toBe(true);
  });

  it('should overwrite existing file', async () => {
    await uploadObject('overwrite.txt', Buffer.from('old'));
    await uploadObject('overwrite.txt', Buffer.from('new'));
    const content = fs.readFileSync(path.join(testDir, 'overwrite.txt')).toString();
    expect(content).toBe('new');
  });

  it('should handle binary data', async () => {
    const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    await uploadObject('image.png', binaryData);
    const readBack = fs.readFileSync(path.join(testDir, 'image.png'));
    expect(readBack).toEqual(binaryData);
  });
});

describe('deleteObject', () => {
  it('should delete existing file', async () => {
    await uploadObject('to-delete.txt', Buffer.from('delete me'));
    const fullPath = path.join(testDir, 'to-delete.txt');
    expect(fs.existsSync(fullPath)).toBe(true);
    await deleteObject('to-delete.txt');
    expect(fs.existsSync(fullPath)).toBe(false);
  });

  it('should not throw when deleting non-existent file', async () => {
    await expect(deleteObject('non-existent.txt')).resolves.not.toThrow();
  });
});

describe('getObjectUrl', () => {
  it('should return URL with default base path', () => {
    const originalBase = process.env.MEDIA_BASE_URL;
    delete process.env.MEDIA_BASE_URL;
    const url = getObjectUrl('nes/screenshots/user1/abc.png');
    expect(url).toBe('/media/nes/screenshots/user1/abc.png');
    process.env.MEDIA_BASE_URL = originalBase;
  });

  it('should return URL with custom base path', () => {
    const originalBase = process.env.MEDIA_BASE_URL;
    process.env.MEDIA_BASE_URL = '/custom-media';
    const url = getObjectUrl('test/file.txt');
    expect(url).toBe('/custom-media/test/file.txt');
    process.env.MEDIA_BASE_URL = originalBase;
  });
});

describe('objectExists', () => {
  it('should return true for existing file', async () => {
    await uploadObject('exists-check.txt', Buffer.from('exists'));
    expect(await objectExists('exists-check.txt')).toBe(true);
  });

  it('should return false for non-existent file', async () => {
    expect(await objectExists('no-such-file.txt')).toBe(false);
  });
});

describe('getObjectSize', () => {
  it('should return file size in bytes', async () => {
    const data = Buffer.from('1234567890');
    await uploadObject('size-check.txt', data);
    const size = await getObjectSize('size-check.txt');
    expect(size).toBe(10);
  });

  it('should throw error for non-existent file', async () => {
    await expect(getObjectSize('no-such-file.txt')).rejects.toThrow('File not found');
  });
});

describe('resolveFilePath', () => {
  it('should return full path joining STORAGE_PATH and objectName', () => {
    const resolved = resolveFilePath('test/file.txt');
    expect(resolved).toBe(path.join(testDir, 'test', 'file.txt'));
  });
});
