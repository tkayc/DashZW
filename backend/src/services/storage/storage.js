/**
 * Product image storage.
 *
 * Local (default): files saved under backend/uploads/ and served at /uploads/...
 * Cloud (production placeholder): set STORAGE_PROVIDER=s3 and S3_* env vars — wire your bucket SDK here.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = path.join(__dirname, '../../../uploads');
export const PRODUCT_UPLOAD_DIR = path.join(UPLOADS_ROOT, 'products');
export const DRIVER_UPLOAD_DIR = path.join(UPLOADS_ROOT, 'drivers');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getStorageProvider() {
  return process.env.STORAGE_PROVIDER || 'local';
}

/**
 * Save a base64 data URL or raw base64 string. Returns a public URL path.
 */
export function saveProductImageFromDataUrl(dataUrl, originalName = 'image.jpg') {
  const provider = getStorageProvider();
  if (provider !== 'local') {
    // TODO(cloud): upload buffer to S3 / Cloudinary / GCS using STORAGE_PROVIDER config
    throw new Error(
      `STORAGE_PROVIDER=${provider} is not configured yet. Use local storage or implement cloud upload.`
    );
  }

  ensureDir(PRODUCT_UPLOAD_DIR);

  const match = String(dataUrl).match(/^data:(image\/[\w+.-]+);base64,(.+)$/i);
  if (!match) throw new Error('Invalid image data — expected a base64 data URL (data:image/...;base64,...)');

  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) throw new Error('Image too large (max 5 MB)');

  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
  const safeBase = (originalName || 'image').replace(/[^\w.-]+/g, '_').slice(0, 40);
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeBase}.${ext}`;
  const filePath = path.join(PRODUCT_UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/products/${filename}`;
}

export function isExternalImageUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

const DRIVER_DOC_TYPES = new Set(['id_document', 'drivers_license', 'vehicle_photo', 'profile_photo']);

/**
 * Save a driver onboarding document (ID, license, vehicle, profile photo).
 * Returns a public URL path under /uploads/drivers/...
 */
export function saveDriverDocumentFromDataUrl(dataUrl, docType = 'document', originalName = 'doc.jpg') {
  const provider = getStorageProvider();
  if (provider !== 'local') {
    throw new Error(
      `STORAGE_PROVIDER=${provider} is not configured yet. Use local storage or implement cloud upload.`
    );
  }

  const type = DRIVER_DOC_TYPES.has(docType) ? docType : 'document';
  ensureDir(DRIVER_UPLOAD_DIR);

  const match = String(dataUrl).match(/^data:(image\/[\w+.-]+);base64,(.+)$/i);
  if (!match) throw new Error('Invalid image data — expected a base64 data URL (data:image/...;base64,...)');

  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 8 * 1024 * 1024) throw new Error('Image too large (max 8 MB)');

  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
  const safeBase = (originalName || type).replace(/[^\w.-]+/g, '_').slice(0, 40);
  const filename = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeBase}.${ext}`;
  const filePath = path.join(DRIVER_UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/drivers/${filename}`;
}
