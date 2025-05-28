import { Client } from 'minio';

const MINIO_PUBLIC_URL = 'https://lmsbackendminio-api.llp.trizenventures.com';

const minioClient = new Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
});

export const uploadProfilePicture = async (file, filename) => {
    try {
        const bucket = 'profile-images-lms';
        const objectName = `${Date.now()}-${filename}`;
        
        // Check if bucket exists, create if it doesn't
        const bucketExists = await minioClient.bucketExists(bucket);
        if (!bucketExists) {
            await minioClient.makeBucket(bucket);
            
            // Set bucket policy to allow public read access
            const policy = {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: { AWS: ['*'] },
                        Action: ['s3:GetObject'],
                        Resource: [`arn:aws:s3:::${bucket}/*`]
                    }
                ]
            };
            await minioClient.setBucketPolicy(bucket, JSON.stringify(policy));
        }
        
        // Upload file to MinIO
        await minioClient.putObject(bucket, objectName, file.buffer, {
            'Content-Type': file.mimetype
        });
        
        // Return the complete URL for database storage
        return `${MINIO_PUBLIC_URL}/${bucket}/${objectName}`;
    } catch (error) {
        console.error('MinIO upload error:', error);
        throw new Error('Failed to upload profile picture');
    }
};

export default minioClient; 