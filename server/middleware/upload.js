import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '../uploads');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const makeStorage = (subdir) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(uploadsRoot, subdir);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });

const imageFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
  cb(ok ? null : new Error('Only image files are allowed'), ok);
};

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx|ppt|pptx|zip/;
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  const ok = allowed.test(ext) || allowed.test(file.mimetype);
  cb(ok ? null : new Error('File type not allowed'), ok);
};

export const uploadProfile = multer({
  storage: makeStorage('profiles'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export const uploadCertificate = multer({
  storage: makeStorage('certificates'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

export const uploadProject = multer({
  storage: makeStorage('projects'),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter,
});

export const uploadProjectFields = uploadProject.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'files', maxCount: 10 },
  { name: 'screenshots', maxCount: 10 },
]);

export const uploadJobCover = multer({
  storage: makeStorage('job-covers'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export const uploadAdImage = multer({
  storage: makeStorage('ads'),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export const handleUpload = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Image is too large. Use a file under 15 MB.' });
    }
    return res.status(400).json({ message: err.message || 'Upload failed' });
  });
};

export const uploadEmployerDocuments = multer({
  storage: makeStorage('employer-docs'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter,
}).fields([
  { name: 'panCard', maxCount: 1 },
  { name: 'businessRegistration', maxCount: 1 },
]);

export const uploadWorkspaceFiles = multer({
  storage: makeStorage('workspace'),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExt = /jpeg|jpg|png|gif|webp|pdf|doc|docx|ppt|pptx|xls|xlsx|txt|zip|rar|mp4|webm|mov/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    const ok = allowedExt.test(ext) || allowedExt.test(file.mimetype.split('/')[1] || '');
    cb(ok ? null : new Error('File type not allowed for workspace attachments'), ok);
  },
});

export const uploadChatFiles = multer({
  storage: makeStorage('chat'),
  limits: { fileSize: 25 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const allowedExt = /jpeg|jpg|png|gif|webp|pdf|doc|docx|ppt|pptx|xls|xlsx|txt|zip|rar|mp4|webm|mov|avi/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    const ok = allowedExt.test(ext)
      || file.mimetype.startsWith('image/')
      || file.mimetype.startsWith('video/')
      || file.mimetype === 'application/pdf'
      || file.mimetype.includes('zip')
      || file.mimetype.includes('rar');
    cb(ok ? null : new Error('File type not allowed in chat'), ok);
  },
});
