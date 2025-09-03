import cloudinary from '../config/cloudinary';

export class CloudinaryService {
  /**
   * Sube una imagen a Cloudinary desde un archivo
   * @param imageFile - Archivo de imagen del formulario
   * @param folder - Carpeta donde guardar la imagen (opcional, default: 'events')
   * @returns Promise con la URL de la imagen subida
   */
  static async uploadImage(
    imageFile: Express.Multer.File,
    folder: string = 'events'
  ): Promise<string> {
    try {
      // Convertir el archivo a base64 para enviarlo a Cloudinary
      const base64Image = `data:${
        imageFile.mimetype
      };base64,${imageFile.buffer.toString('base64')}`;

      const result = await cloudinary.uploader.upload(base64Image, {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ quality: 'auto:good' }, { fetch_format: 'auto' }],
      });

      return result.secure_url;
    } catch (error) {
      console.error('Error al subir imagen a Cloudinary:', error);
      throw new Error('Error al procesar la imagen');
    }
  }

  /**
   * Elimina una imagen de Cloudinary por su URL
   * @param imageUrl - URL de la imagen a eliminar
   * @returns Promise<boolean> - true si se eliminó correctamente
   */
  static async deleteImage(imageUrl: string): Promise<boolean> {
    try {
      const publicId = this.extractPublicIdFromUrl(imageUrl);

      if (!publicId) {
        console.warn(
          'CloudinaryService: No se pudo extraer el public_id de la URL:',
          imageUrl
        );
        return false;
      }

      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === 'ok';
    } catch (error) {
      console.error(
        'CloudinaryService: Error al eliminar imagen de Cloudinary:',
        error
      );
      return false;
    }
  }

  /**
   * Actualiza una imagen: elimina la anterior y sube la nueva
   * @param imageFile - Nuevo archivo de imagen
   * @param oldImageUrl - URL de la imagen anterior (opcional)
   * @param folder - Carpeta donde guardar la imagen (opcional, default: 'events')
   * @returns Promise con la URL de la nueva imagen
   */
  static async updateImage(
    imageFile: Express.Multer.File,
    oldImageUrl?: string,
    folder: string = 'events'
  ): Promise<string> {
    try {
      // Si hay una imagen anterior, intentar eliminarla
      if (oldImageUrl) {
        await this.deleteImage(oldImageUrl);
      }

      // Subir la nueva imagen
      return await this.uploadImage(imageFile, folder);
    } catch (error) {
      console.error('CloudinaryService: Error al actualizar imagen:', error);
      throw new Error('Error al actualizar la imagen');
    }
  }

  /**
   * Extrae el public_id de una URL de Cloudinary
   * @param imageUrl - URL de la imagen de Cloudinary
   * @returns string | null - El public_id extraído o null si no se puede extraer
   */
  private static extractPublicIdFromUrl(imageUrl: string): string | null {
    try {
      // Ejemplo de URL: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/image_name.jpg
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/');

      // Buscar el índice de 'upload' y tomar todo lo que viene después
      const uploadIndex = pathParts.findIndex((part) => part === 'upload');

      if (uploadIndex === -1 || uploadIndex === pathParts.length - 1) {
        return null;
      }

      // Tomar la parte después de 'upload' y antes de la extensión
      const afterUpload = pathParts.slice(uploadIndex + 1);

      if (afterUpload.length === 0) {
        return null;
      }

      // Filtrar la versión (v1234567890) y construir el public_id
      const filteredParts = afterUpload.filter(
        (part) => !part.startsWith('v') || isNaN(parseInt(part.substring(1)))
      );

      if (filteredParts.length === 0) {
        return null;
      }

      // El último elemento es el nombre del archivo con extensión
      const fileName = filteredParts[filteredParts.length - 1];
      const fileNameWithoutExtension = fileName.split('.')[0];

      // Construir el public_id (carpeta + nombre sin extensión)
      const folderPath = filteredParts.slice(0, -1).join('/');
      const publicId = folderPath
        ? `${folderPath}/${fileNameWithoutExtension}`
        : fileNameWithoutExtension;

      return publicId;
    } catch (error) {
      console.error(
        'CloudinaryService: Error al extraer public_id de la URL:',
        error
      );
      return null;
    }
  }
}
