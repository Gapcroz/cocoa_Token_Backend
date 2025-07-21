import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user";

const JWT_SECRET = process.env.JWT_SECRET || "mi_clave_secreta_super_segura";

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "No hay token de autenticación" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ message: "Usuario no encontrado" });
      return;
    }

    (req as any).user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ message: "Token inválido" });
      return;
    }
    res.status(500).json({ message: "Error en la autenticación" });
    return;
  }
};

export const isStore = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    if (!user.isStore) {
      res.status(403).json({ message: "Solo las tiendas pueden realizar esta acción" });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Error en la validación de permisos" });
    return;
  }
};
export const isAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    

    next();
  } catch (error) {
    res.status(500).json({ message: "Error en la validación de permisos" });
    return;
  }
};
export const isRegularUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    if (user.isStore) {
      res.status(403).json({ message: "Esta funcionalidad es solo para usuarios regulares" });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Error en la validación de permisos" });
    return;
  }
};
