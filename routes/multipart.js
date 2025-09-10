import express from 'express';
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const router = express.Router();

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'lmsbackendminio-api.llp.trizenventures.com';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '443', 10);
const MINIO_SSL = process.env.MINIO_USE_SSL !== 'false';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY;
const BUCKET = process.env.MINIO_BUCKET || 'webdevbootcamp1';

const s3 = new S3Client({
  region: process.env.MINIO_REGION || 'us-east-1',
  endpoint: `${MINIO_SSL ? 'https' : 'http'}://${MINIO_ENDPOINT}:${MINIO_PORT}`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
});

router.post('/multipart/initiate', async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    if (!filename) return res.status(400).json({ error: 'filename is required' });

    const cmd = new CreateMultipartUploadCommand({
      Bucket: BUCKET,
      Key: filename,
      ContentType: contentType || 'application/octet-stream',
    });
    const { UploadId } = await s3.send(cmd);
    return res.json({ uploadId: UploadId, bucket: BUCKET, key: filename });
  } catch (err) {
    console.error('initiate multipart error', err);
    return res.status(500).json({ error: 'Failed to initiate multipart upload' });
  }
});

router.post('/multipart/sign-part', async (req, res) => {
  try {
    const { key, uploadId, partNumber } = req.body;
    if (!key || !uploadId || !partNumber) {
      return res.status(400).json({ error: 'key, uploadId, partNumber required' });
    }
    const signedUrl = await getSignedUrl(
      s3,
      new UploadPartCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId: uploadId,
        PartNumber: Number(partNumber),
      }),
      { expiresIn: 3600 }
    );
    return res.json({ url: signedUrl });
  } catch (err) {
    console.error('sign part error', err);
    return res.status(500).json({ error: 'Failed to sign upload part' });
  }
});

router.post('/multipart/complete', async (req, res) => {
  try {
    const { key, uploadId, parts } = req.body;
    if (!key || !uploadId || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'key, uploadId and parts[] required' });
    }

    const cmd = new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .map(p => ({ ETag: p.eTag || p.ETag, PartNumber: Number(p.partNumber) }))
          .filter(p => p.ETag && p.PartNumber),
      },
    });
    const out = await s3.send(cmd);
    return res.json({ location: out.Location, bucket: BUCKET, key });
  } catch (err) {
    console.error('complete multipart error', err);
    return res.status(500).json({ error: 'Failed to complete multipart upload' });
  }
});

router.post('/multipart/abort', async (req, res) => {
  try {
    const { key, uploadId } = req.body;
    if (!key || !uploadId) return res.status(400).json({ error: 'key and uploadId required' });
    await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId }));
    return res.json({ aborted: true });
  } catch (err) {
    console.error('abort multipart error', err);
    return res.status(500).json({ error: 'Failed to abort multipart upload' });
  }
});

export default router;


