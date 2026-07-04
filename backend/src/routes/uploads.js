import { Router } from 'express';
import { authMiddleware } from '../services/authentication/middleware.js';
import { saveProductImageFromDataUrl, isExternalImageUrl } from '../services/storage/storage.js';

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

export default router;
