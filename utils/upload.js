const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = '';
    
    // Определяем папку по типу файла
    if (file.fieldname === 'analysisFile') {
      folder = 'public/uploads/analysis/';
    } else if (file.fieldname === 'schemaImageUpload') {
      folder = 'public/uploads/schemes/';
    } else if (file.fieldname === 'workPhotosUpload') {
      folder = 'public/uploads/works/';
    } else if (file.fieldname === 'schemaImage') {
      folder = 'public/uploads/schemes/';
    } else if (file.fieldname.startsWith('workPhotos')) {
      folder = 'public/uploads/works/';
    } else {
      folder = 'public/uploads/';
    }
    
    // Создаем папку если не существует
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    
    cb(null, folder);
  },
  
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = 'file_' + Date.now() + '_' + Math.round(Math.random() * 1E9) + ext;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  // Анализы воды: PDF, DOC, DOCX, изображения
  if (file.fieldname === 'analysisFile') {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый формат файла анализа. Разрешены: PDF, DOC, DOCX, JPG, PNG'), false);
    }
  }
  // Схемы и фото: только изображения
  else if (file.fieldname === 'schemaImageUpload' || 
           file.fieldname === 'workPhotosUpload' ||
           file.fieldname === 'schemaImage' ||
           file.fieldname.startsWith('workPhotos')) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены для схем и фотографий!'), false);
    }
  } else {
    // Для других полей - стандартная проверка
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения!'), false);
    }
  }
};

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5 МБ
  },
  fileFilter: fileFilter
});

module.exports = upload;
