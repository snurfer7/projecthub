import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import issueRoutes from './routes/issues';
import wikiRoutes from './routes/wiki';
import attachmentRoutes from './routes/attachments';
import timeEntryRoutes from './routes/timeEntries';
import adminRoutes from './routes/admin';
import ganttRoutes from './routes/gantt';
import companyRoutes from './routes/companies';
import crmRoutes from './routes/crm';
import homeRoutes from './routes/home';
import { errorHandler } from './middleware/error';


const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/wiki', wikiRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/gantt', ganttRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/home', homeRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});



app.use(errorHandler);


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
