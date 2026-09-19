const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uploadsDirectory = path.join(__dirname, '..', 'uploads');
const allowedTypes = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

function parseImageData(imageData) {
  const match = String(imageData || '').match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    const error = new Error('Upload a JPG, PNG, WebP, or GIF image.');
    error.status = 422;
    throw error;
  }
  return { extension: match[1] === 'jpeg' ? 'jpg' : match[1], mimeType: allowedTypes[match[1]], buffer: Buffer.from(match[2], 'base64') };
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
  const fileName = `${crypto.randomUUID()}.${extension}`;
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

  fs.mkdirSync(uploadsDirectory, { recursive: true });
  fs.writeFileSync(path.join(uploadsDirectory, fileName), buffer);
  return `/uploads/${fileName}`;
}

async function removeProductImage(imagePath) {
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
