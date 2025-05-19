import express from 'express';
import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import { Client } from 'minio';
import dotenv from 'dotenv';
import { Readable } from 'stream';

dotenv.config();

const router = express.Router();
const uploadPath = path.join(process.cwd(), 'uploads');
const uploadPathChunks = path.join(process.cwd(), 'chunks');

// Ensure the upload directories exist
await fs.mkdir(uploadPath, { recursive: true });
await fs.mkdir(uploadPathChunks, { recursive: true });

console.log('Upload path:', uploadPath);
console.log('Chunk path:', uploadPathChunks);

// Setup MinIO client configuration
const minioClient = new Client({
  endPoint: 'lmsbackendminio-api.llp.trizenventures.com', // Fixed endpoint
  port: 443,
  useSSL: true,
  accessKey: process.env.MINIO_ACCESS_KEY || 'b72084650d4c21dd04b801f0',
  secretKey: process.env.MINIO_SECRET_KEY || 'be2339a15ee0544de0796942ba3a85224cc635',
  region: 'us-east-1',
  pathStyle: true,
  // Additional configuration to improve stability
  connectTimeoutMS: 30000, // 30 seconds
  partSize: 10 * 1024 * 1024, // 10MB part size for multipart uploads
  maxWorkers: 10,
});

async function verifyMinioConfig() {
  try {
    console.log('Verifying MinIO configuration...');
    
    // Add debug logging
    console.log('Raw MinIO client:', {
      endPoint: minioClient.endPoint,
      port: minioClient.port,
      useSSL: minioClient.useSSL,
      region: minioClient.region,
      accessKey: minioClient.accessKey?.substring(0, 5) + '...'
    });

    if (!minioClient.endPoint) {
      throw new Error('Missing MinIO endpoint');
    }
    if (!minioClient.port) {
      throw new Error('Missing MinIO port');
    }
    if (typeof minioClient.useSSL !== 'boolean') {
      throw new Error('Invalid SSL configuration');
    }
    if (!minioClient.accessKey || !minioClient.secretKey) {
      throw new Error('Missing MinIO credentials');
    }

    // Test connection
    await Promise.race([
      minioClient.bucketExists(bucketName),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('MinIO connection timeout')), 5000)
      )
    ]);

    console.log('MinIO configuration verified successfully');
    return true;
  } catch (error) {
    console.error('MinIO configuration error:', error);
    return false;
  }
}

console.log("*****************",minioClient);

let minioAvailable = false;
const bucketName = 'webdevbootcamp1';
minioClient.endPoint = 'lmsbackendminio.llp.trizenventures.com';
const port = 443;
minioClient.useSSL = true;
minioClient.accessKey = 'b72084650d4c21dd04b801f0';
minioClient.secretKey = 'be2339a15ee0544de0796942ba3a85224cc635';

// Replace the existing bucket check with this:
minioClient.bucketExists(bucketName)
  .then(exists => {
    if (!exists) {
      console.log(`Bucket ${bucketName} does NOT exist!`);
      return minioClient.makeBucket(bucketName);
    }
    console.log(`Bucket ${bucketName} exists!`);
  })
  .then(() => {
    console.log('Bucket check/creation completed successfully');
  })
  .catch(err => {
    console.error('Bucket operation failed:', err);
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      code: err.code,
      statusCode: err.statusCode
    });
  });

// Check MinIO connection at startup with detailed error reporting
(async function checkMinioConnection() {
  try {
    console.log('Checking MinIO connection...');
    // Test the connection with a 10-second timeout
    await Promise.race([
      minioClient.bucketExists(bucketName),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('MinIO connection timeout')), 10000)
      )
    ]);
    
    console.log('MinIO connection successful');
    minioAvailable = true;
    
    try {
      const bucketExists = await minioClient.bucketExists(bucketName);
      if (!bucketExists) {
        await minioClient.makeBucket(bucketName);
        console.log(`Created bucket: ${bucketName}`);
        
        // Set bucket policy to public (optional)
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject', 's3:PutObject'],
              Resource: [`arn:aws:s3:::${bucketName}/*`]
            }
          ]
        };
        
        try {
          await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
          console.log(`Set public read policy on bucket: ${bucketName}`);
        } catch (policyError) {
          console.error('Error setting bucket policy (non-fatal):', policyError);
        }
      }
    } catch (bucketError) {
      console.error('Error checking/creating bucket:', bucketError);
      console.log('Will attempt to create bucket on first upload if needed.');
    }
  } catch (err) {
    console.error('MinIO connection error:', err.message);
    console.log('MinIO service is unavailable. Using local storage as fallback.');
    minioAvailable = false;
  }
})();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPathChunks);
  },
  filename: (req, file, cb) => {
    const baseFileName = file.originalname.replace(/\s+/g, '');

    fs.readdir(uploadPathChunks, (err, files) => {
      if (err) {
        return cb(err);
      }

      // Filter files that match the base filename
      const matchingFiles = files.filter((f) => f.startsWith(baseFileName));

      let chunkNumber = 0;
      if (matchingFiles.length > 0) {
        // Extract the highest chunk number
        const highestChunk = Math.max(
          ...matchingFiles.map((f) => {
            const match = f.match(/\.part_(\d+)$/);
            return match ? parseInt(match[1], 10) : -1;
          })
        );
        chunkNumber = highestChunk + 1;
      }

      const fileName = `${baseFileName}.part_${chunkNumber}`;
      cb(null, fileName);
    });
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1000 * 1024 * 1024 }, // 1000MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith('video/') ||
      file.mimetype === 'application/octet-stream'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Not a video file. Please upload only videos.'));
    }
  },
});

router.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file uploaded.' });
  }

  try {
    const chunkNumber = Number(req.body.chunk);
    const totalChunks = Number(req.body.totalChunks);
    const fileName = req.body.originalname.replace(/\s+/g, '');

    // Log upload progress
    console.log(`Processing chunk ${chunkNumber + 1}/${totalChunks} of ${fileName}`);

    if (chunkNumber === totalChunks - 1) {
      try {
        await mergeChunks(fileName, totalChunks);
        console.log(`All chunks merged for ${fileName}`);
        
        const filePath = path.join(uploadPath, fileName);
        let videoUrl = '';
        let usingFallback = false;
        
        // Only try MinIO upload if it was available at startup or we need to check again
        if (minioAvailable) {
          minioAvailable = await verifyMinioConfig();
          try {
            console.log(`Uploading ${filePath} to MinIO bucket ${bucketName}`);
            
            // Try to upload to MinIO with a timeout
            try {
                    minioClient.endpoint = 'lmsbackendminio-api.llp.trizenventures.com';

                    // Log attempt with full config
                    const uploadConfig = {
                      bucket: bucketName,
                      file: fileName,
                      endpoint: minioClient.endPoint,
                      port: minioClient.port,
                      useSSL: minioClient.useSSL,
                      pathStyle: minioClient.pathStyle
                    };
                    console.log('Attempting MinIO upload with config:', uploadConfig);

                    // Verify file exists
                    const fileExists = await fs.pathExists(filePath);
                    if (!fileExists) {
                      throw new Error(`File not found at path: ${filePath}`);
                    }

                    // Attempt upload with timeout
                    await Promise.race([
                      minioClient.fPutObject(bucketName, fileName, filePath, {
                        'Content-Type': 'video/mp4',
                      }),
                      new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('MinIO upload timeout')), 300000)
                      ),
                    ]);

                    console.log('Upload completed successfully');
                    videoUrl = `https://lmsbackendminio-api.llp.trizenventures.com/${bucketName}/${fileName}`;
                    
                    // Delete the local file after successful upload to MinIO
                    try {
                      await fs.unlink(filePath);
                      console.log(`Successfully deleted local file: ${filePath}`);
                    } catch (deleteError) {
                      console.error(`Error deleting local file ${filePath}:`, deleteError);
                      // Continue even if delete fails - don't fail the upload
                    }
                    
                  } catch (uploadError) {
                    console.error('MinIO Upload Error:', {
                      name: uploadError.name,
                      message: uploadError.message,
                      code: uploadError.code,
                      statusCode: uploadError.statusCode,
                      stack: uploadError.stack,
                      endpoint: minioClient.endPoint,
                      bucket: bucketName
                    });
                    minioAvailable = false;
                    usingFallback = true;
                    // Use a safe fallback URL
                    const protocol = minioClient.endPoint?.includes('localhost') ? 'http' : 'https';
                    videoUrl = `${protocol}://lmsbackendminio-api.llp.trizenventures.com/${bucketName}/${fileName}`;
                    console.log('Using fallback URL:', videoUrl);
                  }
            
            console.log(`File ${fileName} uploaded to MinIO successfully`);
            
            // Generate a presigned URL for the uploaded video
            // Update fallback URL to use HTTPS
          // Replace the videoUrl generation in the catch block
          videoUrl = minioClient.endPoint 
            ? `https://lmsbackendminio-api.llp.trizenventures.com/${bucketName}/${fileName}`
            : `http://localhost:9000/${bucketName}/${fileName}`;
          console.log('Using fallback URL:', videoUrl);
          } catch (minioError) {
            console.error('Error uploading to MinIO:', minioError);
            minioAvailable = false;
            usingFallback = true;
            
            // Provide fallback URL if MinIO upload fails
            videoUrl = `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || 9000}/${bucketName}/${fileName}`;
            console.log('Using fallback URL:', videoUrl);
          }
        } else {
          usingFallback = true;
          videoUrl = `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || 9000}/${bucketName}/${fileName}`;
          console.log('MinIO unavailable, using fallback URL:', videoUrl);
        }
        
        const fileInfo = {
          filename: fileName,
          originalName: req.body.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          baseURL: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || 9000}/${bucketName}/`,
          videoUrl: videoUrl,
        };
        
        if (usingFallback) {
          return res.status(200).json({
            message: 'File processed but cloud storage unavailable. Using local storage.',
            file: fileInfo
          });
        } else {
          return res.status(200).json({
            message: 'File uploaded successfully to cloud storage.',
            file: fileInfo
          });
        }
      } catch (mergeError) {
        console.error('Error merging chunks:', mergeError);
        return res.status(500).json({ 
          error: 'Failed to process uploaded file chunks', 
          details: mergeError.message 
        });
      }
    } else {
      // Non-final chunk - just acknowledge receipt
      res.status(200).json({
        message: 'Chunk uploaded successfully',
        chunk: chunkNumber + 1,
        totalChunks: totalChunks
      });
    }
  } catch (error) {
    console.error('Error during file upload:', error);
    res
      .status(500)
      .json({ error: 'An error occurred while uploading the video.' });
  }
});

const MAX_RETRIES = 5;
const RETRY_DELAY = 1000; // 1 second
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function mergeChunks(fileName, totalChunks) {
  console.log(`Starting to merge ${totalChunks} chunks for ${fileName}`);
  const writeStream = fs.createWriteStream(path.join(uploadPath, fileName));

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(uploadPathChunks, `${fileName}.part_${i}`);
    let retries = 0;

    console.log(`Processing chunk ${i + 1}/${totalChunks} from ${chunkPath}`);
    
    // Check if chunk exists before attempting to read
    if (!fs.existsSync(chunkPath)) {
      console.error(`Chunk file not found: ${chunkPath}`);
      throw new Error(`Chunk file ${i} not found`);
    }

    while (retries < MAX_RETRIES) {
      try {
        const chunkStream = fs.createReadStream(chunkPath);
        await new Promise((resolve, reject) => {
          chunkStream.pipe(writeStream, { end: false });
          chunkStream.on('end', resolve);
          chunkStream.on('error', reject);
        });
        console.log(`Chunk ${i} merged successfully`);
        await fs.promises.unlink(chunkPath);
        console.log(`Chunk ${i} deleted successfully`);
        break; // Success, move to next chunk
      } catch (error) {
        if (error.code === 'EBUSY') {
          console.log(
            `Chunk ${i} is busy, retrying... (${retries + 1}/${MAX_RETRIES})`
          );
          await delay(RETRY_DELAY);
          retries++;
        } else {
          console.error(`Error processing chunk ${i}:`, error);
          throw error; // Unexpected error, rethrow
        }
      }
    }

    if (retries === MAX_RETRIES) {
      console.error(`Failed to merge chunk ${i} after ${MAX_RETRIES} retries`);
      writeStream.end();
      throw new Error(`Failed to merge chunk ${i}`);
    }
  }

  writeStream.end();
  console.log('All chunks merged successfully');
}

// Add function to clean up any existing files in the uploads directory
async function cleanupExistingFiles() {
  try {
    console.log('Cleaning up any existing files in the uploads directory');
    const files = await fs.readdir(uploadPath);
    
    for (const file of files) {
      try {
        const filePath = path.join(uploadPath, file);
        await fs.unlink(filePath);
        console.log(`Deleted existing file: ${filePath}`);
      } catch (err) {
        console.error(`Error deleting file ${file}:`, err);
      }
    }
    
    console.log('Uploads directory cleanup completed');
  } catch (err) {
    console.error('Error cleaning up uploads directory:', err);
  }
}

// Clean up all existing files in uploads directory on server start
cleanupExistingFiles();

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.log('Multer error:', err.message);
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    fs.readdir(uploadPathChunks, (err, files) => {
      if (err) {
        return console.error('Unable to scan directory: ' + err);
      } 
  
      // Iterate over the files and delete each one
      files.forEach(file => {
        const filePath = path.join(uploadPathChunks, file);
  
        fs.promises.unlink(filePath, err => {
          if (err) {
            console.error('Error deleting file:', filePath, err);
          } else {
            console.log('Successfully deleted file:', filePath);
          }
        });
      });
    });
    console.log('General error:', err.message);
    return res.status(500).json({ error: err.message });
  }
  next();
});

export default router;
