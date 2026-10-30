const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const catalogImages = require('./catalog-images.json');

function uploadError(message, status = 503) {
  return Object.assign(new Error(message), { status });
}

function cloudinarySettings() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if ([cloud, key, secret].some(Boolean) && ![cloud, key, secret].every(Boolean)) {
    throw uploadError('Image storage is only partially configured. Set all three Cloudinary server variables.');
  }
  return cloud && key && secret ? { cloud, key, secret } : null;
}

async function cloudinaryRequest(storage, action, params, buffer, mimeType, fileName) {
  params.timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHash('sha256').update(Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + storage.secret).digest('hex');
  const form = new FormData();
  for (const [key, value] of Object.entries(params)) form.set(key, value);
  form.set('api_key', storage.key);
  form.set('signature', signature);
  if (buffer) form.set('file', new Blob([buffer], { type: mimeType }), fileName);
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(storage.cloud)}/image/${action}`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('Storage request rejected');
    return await response.json();
  } catch {
    throw uploadError('Image storage could not save the change. Check the Cloudinary configuration and try again.', 502);
  }
}

const uploadsDirectory = path.join(__dirname, '..', 'uploads');
const allowedTypes = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

function parseImageData(imageData) {
  const match = String(imageData || '').match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    const error = new Error('Upload a JPG, PNG, WebP, or GIF image.');
    error.status = 422;
    throw error;
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 3 * 1024 * 1024) throw uploadError('Image must be between 1 byte and 3 MB.', 422);
  return { extension: match[1] === 'jpeg' ? 'jpg' : match[1], mimeType: allowedTypes[match[1]], buffer };
}

function storageSettings() {
  const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  // SUPABASE_SECRET_KEY is the current Supabase key type. Keep the legacy
  // variable as a fallback for older projects.
  const serviceRoleKey = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const bucket = String(process.env.SUPABASE_STORAGE_BUCKET || 'product-images');
  return baseUrl && serviceRoleKey ? { baseUrl, serviceRoleKey, bucket } : null;
}

async function saveProductImage(imageData) {
  const { extension, mimeType, buffer } = parseImageData(imageData);
  const existing = catalogImages[crypto.createHash('sha256').update(buffer).digest('hex')];
  if (existing) return existing;
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const cloudinary = cloudinarySettings();
  if (cloudinary) {
    const publicId = `techora/products/${crypto.randomUUID()}`;
    const result = await cloudinaryRequest(cloudinary, 'upload', { public_id: publicId, overwrite: 'false', type: 'upload' }, buffer, mimeType, fileName);
    const prefix = `https://res.cloudinary.com/${cloudinary.cloud}/image/upload/`;
    if (result.public_id !== publicId || typeof result.secure_url !== 'string' || !result.secure_url.startsWith(prefix)) throw uploadError('Image storage returned an invalid image URL.', 502);
    return result.secure_url;
  }
  const storage = storageSettings();

  if (storage) {
    const response = await fetch(`${storage.baseUrl}/storage/v1/object/${encodeURIComponent(storage.bucket)}/${encodeURIComponent(fileName)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${storage.serviceRoleKey}`,
        apikey: storage.serviceRoleKey,
        'Content-Type': mimeType,
        'x-upsert': 'false'
      },
      body: buffer
    });
    if (!response.ok) {
      const error = new Error('Could not store the product image. Confirm that the Supabase Storage bucket exists and the server variables are set.');
      error.status = 502;
      throw error;
    }
    return `${storage.baseUrl}/storage/v1/object/public/${encodeURIComponent(storage.bucket)}/${encodeURIComponent(fileName)}`;
  }

  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw uploadError('New image uploads need cloud storage. Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in Vercel, then redeploy. Existing catalog images can still be selected.');
  }
  fs.mkdirSync(uploadsDirectory, { recursive: true });
  fs.writeFileSync(path.join(uploadsDirectory, fileName), buffer);
  return `/uploads/${fileName}`;
}

async function removeProductImage(imagePath) {
  // Bundled catalog files may be shared; never delete deployment assets.
  if (imagePath?.startsWith('/catalog-assets/')) return;
  const cloudinary = cloudinarySettings();
  if (cloudinary && typeof imagePath === 'string') {
    const prefix = `https://res.cloudinary.com/${cloudinary.cloud}/image/upload/`;
    if (imagePath.startsWith(prefix)) {
      const match = imagePath.slice(prefix.length).match(/^v\d+\/(techora\/products\/[0-9a-f-]{36})\.[a-z0-9]+$/i);
      if (!match) return;
      await cloudinaryRequest(cloudinary, 'destroy', { public_id: match[1], invalidate: 'true', type: 'upload' });
      return;
    }
  }
  const storage = storageSettings();
  if (storage && imagePath?.startsWith(`${storage.baseUrl}/storage/v1/object/public/${encodeURIComponent(storage.bucket)}/`)) {
    const objectName = imagePath.slice(`${storage.baseUrl}/storage/v1/object/public/${encodeURIComponent(storage.bucket)}/`.length);
    await fetch(`${storage.baseUrl}/storage/v1/object/${encodeURIComponent(storage.bucket)}/${objectName}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${storage.serviceRoleKey}`, apikey: storage.serviceRoleKey }
    });
    return;
  }
  if (imagePath?.startsWith('/uploads/')) {
    const filePath = path.join(uploadsDirectory, path.basename(imagePath));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

module.exports = { uploadsDirectory, saveProductImage, removeProductImage };
