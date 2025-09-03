import { Request, Response } from "express";
import User from "../models/user";

export const getStores = async (req: Request, res: Response) => {
  try {
    const stores = await User.find({ isStore: true }).select('-password');
    res.json(stores);
  } catch (error) {
    console.error("Error al obtener tiendas:", error);
    res.status(500).json({ message: "Error al obtener tiendas" });
  }
}; 