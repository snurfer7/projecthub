import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { uploadFileToS3, deleteFileFromS3, getSignedDownloadUrl } from '../services/s3';

const router = Router();
const prisma = new PrismaClient();

// memory storage for multer (files will be sent to S3)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authenticateToken);

// List attachments for project
router.get('/project/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const attachments = await prisma.attachment.findMany({
      where: { projectId: Number(req.params.projectId) },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(attachments);
  } catch (e) {
    res.status(500).json({ error: 'ファイルの取得に失敗しました' });
  }
});

// Upload file
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'ファイルが必要です' });
      return;
    }
    const { projectId, issueId } = req.body;
    
    // Generate S3 key
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const s3Key = `uploads/${uniqueSuffix}-${req.file.originalname}`;
    
    // Upload to S3
    await uploadFileToS3(s3Key, req.file.buffer, req.file.mimetype);
    
    const attachment = await prisma.attachment.create({
      data: {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: s3Key, // Store S3 key instead of local path
        projectId: projectId ? Number(projectId) : null,
        issueId: issueId ? Number(issueId) : null,
        authorId: req.userId!,
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.status(201).json(attachment);
  } catch (e) {
    console.error('File upload error:', e);
    res.status(500).json({ error: 'ファイルのアップロードに失敗しました' });
  }
});

// Download file (with signed URL)
router.get('/download/:id', async (req: AuthRequest, res: Response) => {
  try {
    const attachment = await prisma.attachment.findUnique({ where: { id: Number(req.params.id) } });
    if (!attachment) {
      res.status(404).json({ error: 'ファイルが見つかりません' });
      return;
    }
    
    // Get signed URL from S3
    const signedUrl = await getSignedDownloadUrl(attachment.filePath, 3600); // 1 hour expiration
    res.json({ url: signedUrl, filename: attachment.filename });
  } catch (e) {
    console.error('File download error:', e);
    res.status(500).json({ error: 'ファイルのダウンロードに失敗しました' });
  }
});

// Delete file
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const attachment = await prisma.attachment.findUnique({ where: { id: Number(req.params.id) } });
    if (!attachment) {
      res.status(404).json({ error: 'ファイルが見つかりません' });
      return;
    }
    
    // Delete from S3
    await deleteFileFromS3(attachment.filePath);
    
    await prisma.attachment.delete({ where: { id: attachment.id } });
    res.json({ message: 'ファイルを削除しました' });
  } catch (e) {
    console.error('File delete error:', e);
    res.status(500).json({ error: 'ファイルの削除に失敗しました' });
  }
});

export default router;
