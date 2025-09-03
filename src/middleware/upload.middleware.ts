import multer from 'multer';

// Configuración de multer para manejar archivos en memoria
const storage = multer.memoryStorage();

// Filtro para validar tipos de archivo
const fileFilter = (req: any, file: any, cb: any) => {
  // Verificar si es una imagen
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen'));
  }
};

// Configuración de multer
export const uploadImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
});

// Middleware para manejar errores de multer
export const handleMulterError = (
  error: any,
  req: any,
  res: any,
  next: any
) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo es demasiado grande. Máximo 5MB',
      });
    }
  } else if (error.message === 'Solo se permiten archivos de imagen') {
    return res.status(400).json({
      success: false,
      message: 'Solo se permiten archivos de imagen',
    });
  }

  next(error);
};
