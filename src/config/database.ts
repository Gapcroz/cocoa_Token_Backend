import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Carga el archivo .env desde la raíz del proyecto (1 nivel arriba si estás en src/)
dotenv.config({
  path: path.resolve(__dirname, '../../.env')
});

const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error("❌ La variable MONGO_URI no está definida en .env");
}

export const connectDB = async () => {
  try {
    await mongoose.connect(uri);
    console.log('✅ Conectado a MongoDB Atlas');
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', error);
    process.exit(1);
  }
};
