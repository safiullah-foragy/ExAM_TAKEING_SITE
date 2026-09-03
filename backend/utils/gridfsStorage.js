const mongoose = require('mongoose');
const fs = require('fs');

let gridFSBucket = null;

const getGridFSBucket = () => {
  if (!gridFSBucket) {
    if (!mongoose.connection || !mongoose.connection.db) {
      throw new Error('MongoDB database connection is not ready');
    }
    gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'exam_pdfs',
    });
  }
  return gridFSBucket;
};

/**
 * Upload a file (Buffer or disk path) to MongoDB GridFS
 * @param {Buffer|string} bufferOrPath
 * @param {string} filename
 * @param {string} contentType
 * @returns {Promise<{fileId: string, filename: string, length: number}>}
 */
const uploadToGridFS = async (bufferOrPath, filename, contentType = 'application/pdf') => {
  const fileBuffer = Buffer.isBuffer(bufferOrPath)
    ? bufferOrPath
    : fs.readFileSync(bufferOrPath);

  const bucket = getGridFSBucket();
  const safeFilename = filename || `exam_${Date.now()}.pdf`;

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(safeFilename, {
      contentType,
      metadata: {
        uploadedAt: new Date(),
      },
    });

    uploadStream.on('error', (err) => reject(err));
    uploadStream.on('finish', (file) => {
      resolve({
        fileId: file._id.toString(),
        filename: file.filename,
        length: file.length,
      });
    });

    uploadStream.end(fileBuffer);
  });
};

/**
 * Check if a file exists in GridFS
 * @param {string} fileId
 * @returns {Promise<boolean>}
 */
const existsInGridFS = async (fileId) => {
  try {
    if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) return false;
    const bucket = getGridFSBucket();
    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
    return files && files.length > 0;
  } catch {
    return false;
  }
};

/**
 * Get readable download stream from GridFS
 * @param {string} fileId
 */
const getGridFSDownloadStream = (fileId) => {
  if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
    throw new Error('Invalid GridFS file ID');
  }
  const bucket = getGridFSBucket();
  return bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
};

/**
 * Read entire file from GridFS as Buffer
 * @param {string} fileId
 * @returns {Promise<Buffer>}
 */
const getBufferFromGridFS = async (fileId) => {
  return new Promise((resolve, reject) => {
    try {
      const stream = getGridFSDownloadStream(fileId);
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Delete a file from GridFS
 * @param {string} fileId
 */
const deleteFromGridFS = async (fileId) => {
  try {
    if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) return;
    const bucket = getGridFSBucket();
    await bucket.delete(new mongoose.Types.ObjectId(fileId));
  } catch (err) {
    console.error('Error deleting from GridFS:', err.message);
  }
};

module.exports = {
  getGridFSBucket,
  uploadToGridFS,
  existsInGridFS,
  getGridFSDownloadStream,
  getBufferFromGridFS,
  deleteFromGridFS,
};
