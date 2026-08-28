const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/^["']|["']$/g, '');
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/^["']|["']$/g, '');

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

const BUCKET = (process.env.SUPABASE_BUCKET || 'exam-files').trim().replace(/^["']|["']$/g, '');

/**
 * Upload a local file to Supabase Storage
 * @param {string} localFilePath - Path to file on disk
 * @param {string} destinationPath - Storage path (e.g. 'photos/myphoto.jpg')
 * @param {string} contentType - Optional mime type
 * @returns {Promise<string>} Public URL of uploaded file
 */
const uploadToSupabase = async (localFilePath, destinationPath, contentType) => {
  const fileBuffer = fs.readFileSync(localFilePath);

  const options = {
    upsert: true,
  };
  if (contentType) options.contentType = contentType;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(destinationPath, fileBuffer, options);

  if (error) {
    throw new Error(`Supabase upload error: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(destinationPath);
  return urlData.publicUrl;
};

/**
 * Delete a file from Supabase Storage
 * @param {string} filePath - Storage path or public URL
 */
const deleteFromSupabase = async (filePath) => {
  if (!filePath) return;
  try {
    let storagePath = filePath;
    // If it's a full public URL, extract the relative path inside the bucket
    if (filePath.includes(`/public/${BUCKET}/`)) {
      storagePath = filePath.split(`/public/${BUCKET}/`)[1];
    }
    await supabase.storage.from(BUCKET).remove([storagePath]);
  } catch (err) {
    console.error('Error deleting from Supabase:', err.message);
  }
};

module.exports = {
  supabase,
  uploadToSupabase,
  deleteFromSupabase,
  BUCKET,
};
