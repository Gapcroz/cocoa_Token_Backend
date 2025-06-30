import { Request, Response } from "express";
import Coupon from "../models/coupon";
import User from "../models/user";

export const createCoupon = async (req: Request, res: Response) => {
  try {
    const { name, description, socialEvent, tokensRequired, expirationDate } =
      req.body;
    const storeId = (req as any).user?.get("id");

    if (!name || !description || !tokensRequired || !expirationDate) {
      res.status(400).json({ message: "Faltan campos requeridos" });
      return;
    }

    const store = await User.findOne({ where: { id: storeId, isStore: true } });
    if (!store) {
      res
        .status(403)
        .json({ message: "Solo las tiendas pueden crear cupones" });
      return;
    }

    const coupon = await Coupon.create({
      name,
      description,
      socialEvent,
      tokensRequired,
      expirationDate,
      storeId,
    });

    res.status(201).json(coupon);
  } catch (error) {
    console.error("Error al crear cupón:", error);
    res.status(500).json({ message: "Error al crear el cupón" });
  }
};

export const getCouponsByStore = async (req: Request, res: Response) => {
  try {
    const storeId = (req as any).user?.get("id");

    if (!storeId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const store = await User.findOne({ _id: storeId, isStore: true });

    if (!store) {
      res
        .status(403)
        .json({ message: "Solo las tiendas pueden ver sus cupones" });
      return;
    }

    const coupons = await Coupon.find({ storeId }).populate({
      path: "storeId",
      select: "name email",
    });

    res.json(coupons);
  } catch (error) {
    console.error("Error al obtener cupones:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

export const updateCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const storeId = (req as any).user?.get("id");

    const coupon = await Coupon.findOne({
      where: { id, storeId },
    });

    if (!coupon) {
      res.status(404).json({ message: "Cupón no encontrado" });
      return;
    }

    Object.assign(coupon, req.body);
    await coupon.save();

    res.json({ message: "Cupón actualizado correctamente", coupon });
  } catch (error) {
    console.error("Error al actualizar cupón:", error);
    res.status(500).json({ message: "Error al actualizar el cupón" });
  }
};

export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const storeId = (req as any).user?.get("id");

    const coupon = await Coupon.findOne({
      where: { id, storeId },
    });

    if (!coupon) {
      res.status(404).json({ message: "Cupón no encontrado" });
      return;
    }

    await coupon.deleteOne();
    res.json({ message: "Cupón eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar cupón:", error);
    res.status(500).json({ message: "Error al eliminar el cupón" });
  }
};

export const getUserCoupons = async (req: Request, res: Response) => {
  try {
    const coupons = await Coupon.find({
      status: "available",
      expirationDate: { $gt: new Date() },
    }).populate({
      path: "storeId",
      select: "name email",
    });

    res.json(coupons);
  } catch (error) {
    console.error("Error al obtener cupones:", error);
    res.status(500).json({ message: "Error al obtener los cupones" });
  }
};
