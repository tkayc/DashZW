import { Router } from 'express';
import { authMiddleware, optionalAuth } from '../services/authentication/middleware.js';
import {
  saveProductImageFromDataUrl,
  saveDriverDocumentFromDataUrl,
  isExternalImageUrl,
} from '../services/storage/storage.js';

const router = Router();

function canUpload(user) {
  const role = user?.role;
  return role === 'admin' || role === 'super_admin' || role === 'partner' || role === 'merchant_owner';
}

/** POST { dataUrl, filename? } → { url } */
router.post('/product-image', authMiddleware, (req, res) => {
  if (!canUpload(req.user)) {
    return res.status(403).json({ message: 'Only merchants and admins can upload product images' });
  }

  const { dataUrl, url, filename } = req.body || {};

  if (url && isExternalImageUrl(url)) {
    return res.json({ url, storage: 'external' });
  }

  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ message: 'dataUrl (base64 image) or external url is required' });
  }

  try {
    const savedUrl = saveProductImageFromDataUrl(dataUrl, filename);
    return res.json({ url: savedUrl, storage: 'local' });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Upload failed' });
  }
});

/**
 * Driver document upload — allowed during signup (optionalAuth) or when logged in as driver/admin.
 * POST { dataUrl, docType, filename? } → { url }
 */
router.post('/driver-document', optionalAuth, (req, res) => {
  const role = req.user?.role;
  const allowed =
    !req.user ||
    role === 'driver' ||
    role === 'admin' ||
    role === 'super_admin';
  if (!allowed) {
    return res.status(403).json({ message: 'Only drivers can upload onboarding documents' });
  }

  const { dataUrl, docType, filename } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ message: 'dataUrl (base64 image) is required' });
  }

  try {
    const savedUrl = saveDriverDocumentFromDataUrl(dataUrl, docType || 'document', filename);
    return res.json({ url: savedUrl, storage: 'local', docType: docType || 'document' });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Upload failed' });
  }
});

export default router;
