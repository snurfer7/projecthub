import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { authenticateToken, AuthRequest, generateDownloadToken, verifyDownloadToken } from '../middleware/auth';
import { uploadFileToS3, deleteFileFromS3, getSignedDownloadUrl } from '../services/s3';

const router = Router();
const prisma = new PrismaClient();

// memory storage for multer (files will be sent to S3)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Upload file
router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'ファイルが必要です' });
      return;
    }
    const { projectId, issueId, issueCommentId, projectCommentId, companyCommentId, contactCommentId } = req.body;

    const toNumber = (val: any) => {
      const n = Number(val);
      return isNaN(n) ? null : n;
    };

    // Correct Multer's misinterpretation of UTF-8 filenames
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // Generate S3 key
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const s3Key = `uploads/${uniqueSuffix}-${originalName}`;

    // Upload to S3
    await uploadFileToS3(s3Key, req.file.buffer, req.file.mimetype);

    const attachment = await prisma.attachment.create({
      data: {
        filename: originalName,
        contentType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: s3Key, // Store S3 key instead of local path
        projectId: toNumber(projectId),
        issueId: toNumber(issueId),
        issueCommentId: toNumber(issueCommentId),
        projectCommentId: toNumber(projectCommentId),
        companyCommentId: toNumber(companyCommentId),
        contactCommentId: toNumber(contactCommentId),
        authorId: req.userId!,
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.status(201).json(attachment);
  } catch (e) {
    console.error('File upload fatal error:', e);
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({
      error: 'ファイルのアップロードに失敗しました',
      details: process.env.NODE_ENV === 'development' ? message : undefined
    });
  }
});

// Get a short-lived download token
router.post('/token/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const attachmentId = Number(req.params.id);
    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) {
      res.status(404).json({ error: 'ファイルが見つかりません' });
      return;
    }

    const token = generateDownloadToken(attachmentId, req.userId!);
    res.json({ token });
  } catch (e) {
    console.error('Token generation error:', e);
    res.status(500).json({ error: 'トークンの発行に失敗しました' });
  }
});

// Download file (with signed URL) - Legacy/Internal use
router.get('/download/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
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

// Get file content directly (Proxy for browser access)
router.get('/file/:id', async (req: AuthRequest, res: Response) => {
  try {
    const attachmentId = Number(req.params.id);
    const downloadToken = req.query.downloadToken as string;

    if (!downloadToken) {
      res.status(401).json({ error: '認証が必要です' });
      return;
    }

    const payload = verifyDownloadToken(downloadToken);
    if (!payload || payload.attachmentId !== attachmentId) {
      res.status(403).json({ error: 'トークンが無効または期限切れです' });
      return;
    }

    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) {
      res.status(404).json({ error: 'ファイルが見つかりません' });
      return;
    }

    const { getFileFromS3 } = await import('../services/s3');
    const buffer = await getFileFromS3(attachment.filePath);

    const filename = attachment.filename;
    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  } catch (e) {
    console.error('File content fetch error:', e);
    res.status(500).json({ error: 'ファイルの取得に失敗しました' });
  }
});

// Delete file
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
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
