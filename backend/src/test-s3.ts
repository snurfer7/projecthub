import { S3Client, ListBucketsCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    endpoint: 'http://127.0.0.1:9000', // Use localhost for testing
    forcePathStyle: true,
});

async function test() {
    try {
        const data = await s3Client.send(new ListBucketsCommand({}));
        console.log('Buckets:', data.Buckets?.map(b => b.Name));

        const bucketName = process.env.S3_BUCKET_NAME || 'redmine-uploads';
        if (!data.Buckets?.find(b => b.Name === bucketName)) {
            console.log(`Creating bucket ${bucketName}...`);
            await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
            console.log('Bucket created.');
        } else {
            console.log(`Bucket ${bucketName} already exists.`);
        }
    } catch (err) {
        console.error('S3 Test Error:', err);
    }
}

test();
