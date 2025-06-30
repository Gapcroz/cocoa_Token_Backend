import { Request, Response } from "express";
import Coupon from "../models/coupon";

// Obtener cupones no expirados y bloqueados para el usuario
export const getAvailableCouponsForUser = async (
  req: Request,
  res: Response
) => {
  try {
    const now = new Date();

    const coupons = await Coupon.find({
      expirationDate: { $gt: now },
      status: "locked",
    });

    res.json(coupons);
    return;
  } catch (error) {
    console.error("Error al obtener cupones para usuario:", error);
    res.status(500).json({ message: "Error al obtener los cupones" });
    return;
  }
};
