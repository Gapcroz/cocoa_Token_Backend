import { Request, Response } from "express";
import Coupon from "../models/coupon";

export const createCoupon = async (req: Request, res: Response) => {
  try {
    const { name, description, socialEvent, tokensRequired, expirationDate } =
      req.body;
    const storeId = (req as any).user?._id;

    if (!name || !description || !tokensRequired || !expirationDate) {
      res.status(400).json({ message: "Faltan campos requeridos" });
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
    const storeId = (req as any).user?._id;
    console.log('🔎 Buscando cupones para storeId:', storeId);

    const coupons = await Coupon.find({ storeId }).populate({
      path: "storeId",
      select: "name email",
    });

    console.log('📝 Cupones encontrados:', coupons.map(c => ({ id: c._id, name: c.name, tokensRequired: c.tokensRequired, expirationDate: c.expirationDate })));
    res.json(coupons);
  } catch (error) {
    console.error("Error al obtener cupones:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

export const updateCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const storeId = (req as any).user?._id;

    const coupon = await Coupon.findOne({
      _id: id,
      storeId: storeId,
    });

    if (!coupon) {
      res.status(404).json({ message: "Cupón no encontrado" });
      return;
    }

    // Solo actualizar campos permitidos, nunca storeId
    const { name, description, socialEvent, tokensRequired, expirationDate, status } = req.body;
    if (name !== undefined) coupon.name = name;
    if (description !== undefined) coupon.description = description;
    if (socialEvent !== undefined) coupon.socialEvent = socialEvent;
    if (tokensRequired !== undefined) coupon.tokensRequired = tokensRequired;
    if (expirationDate !== undefined) coupon.expirationDate = expirationDate;
    if (status !== undefined) coupon.status = status;
    // Refuerzo: si el documento perdió storeId, lo reasignamos automáticamente
    if (!coupon.storeId) coupon.storeId = storeId;

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
    const storeId = (req as any).user?._id;

    const coupon = await Coupon.findOne({
      _id: id,
      storeId: storeId,
    });

    if (!coupon) {
      res.status(404).json({ message: "Cupón no encontrado" });
      return;
    }

    await Coupon.deleteOne({ _id: id });
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
