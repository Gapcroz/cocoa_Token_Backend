import { Request } from 'express';
import { Model } from 'sequelize';

declare global {
  namespace Express {
    interface Request {
      user?: Model<any, any>;
    }
  }

  declare namespace NodeJS {
  interface ProcessEnv {
    MONGO_URI: string;
    PORT: string;
    JWT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
  }
}

export {};
}
