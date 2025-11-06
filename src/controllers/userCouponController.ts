import { Request, Response } from "express";
import Coupon from "../models/coupon";
import User from "../models/user";
import UserCoupon from "../models/userCoupon";

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

// Activar (canjear) un cupón para el usuario autenticado
export const activateCoupon = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const { couponId } = req.body;
    if (!userId || !couponId) {
      res.status(400).json({ message: "Faltan datos requeridos" });
      return;
    }

    // Verificar si el usuario ya activó este cupón
    const alreadyActivated = await UserCoupon.findOne({ userId, couponId });
    if (alreadyActivated) {
      res.status(409).json({ message: "Ya has activado este cupón" });
      return;
    }

    // Buscar usuario y cupón
    const user = await User.findById(userId);
    const coupon = await Coupon.findById(couponId);
    if (!user || !coupon) {
      res.status(404).json({ message: "Usuario o cupón no encontrado" });
      return;
    }

    // Verificar tokens suficientes
    if (user.tokens < coupon.tokensRequired) {
      res.status(400).json({ message: "No tienes tokens suficientes" });
      return;
    }

    // Restar tokens y guardar usuario
    user.tokens -= coupon.tokensRequired;
    await user.save();

    // Crear UserCoupon
    const userCoupon = await UserCoupon.create({
      userId,
      couponId,
      status: "active",
      activationDate: new Date(),
    });

    res.status(201).json({ message: "Cupón activado", userCoupon });
    return;
  } catch (error) {
    console.error("Error al activar cupón:", error);
    res.status(500).json({ message: "Error al activar el cupón" });
    return;
  }
};

// Obtener todos los cupones activados por el usuario autenticado
export const getUserActivatedCoupons = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }
    // Buscar todos los UserCoupon del usuario y popular datos del cupón
    const userCoupons = await UserCoupon.find({ userId })
      .populate({ path: "couponId", model: "Coupon" });
    res.json(userCoupons);
    return;
  } catch (error) {
    console.error("Error al obtener cupones activados:", error);
    res.status(500).json({ message: "Error al obtener los cupones activados" });
    return;
  }
};

// Marcar un cupón activado como usado (por ejemplo, al escanear QR)
export const useActivatedCoupon = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const { userCouponId } = req.body;
    if (!userId || !userCouponId) {
      res.status(400).json({ message: "Faltan datos requeridos" });
      return;
    }
    // Buscar el UserCoupon
    const userCoupon = await UserCoupon.findOne({ _id: userCouponId, userId });
    if (!userCoupon) {
      res.status(404).json({ message: "Cupón activado no encontrado" });
      return;
    }
    if (userCoupon.status === "used") {
      res.status(409).json({ message: "Este cupón ya fue usado" });
      return;
    }
    userCoupon.status = "used";
    userCoupon.usedDate = new Date();
    await userCoupon.save();
    res.json({ message: "Cupón marcado como usado", userCoupon });
    return;
  } catch (error) {
    console.error("Error al marcar cupón como usado:", error);
    res.status(500).json({ message: "Error al marcar el cupón como usado" });
    return;
  }
};

// Escanear y canjear un cupón desde una tienda mediante QR
export const scanCouponForStore = async (req: Request, res: Response) => {
  try {
    const storeUser = (req as any).user;
    const { code } = req.body as { code?: string };

    if (!storeUser || !storeUser.isStore) {
      res.status(403).json({ message: "Solo las tiendas pueden realizar esta acción" });
      return;
    }

    if (!code) {
      res.status(400).json({ message: "Código inválido" });
      return;
    }

    const normalizedCode = code.startsWith("COCOA:") ? code.split(":")[1] : code;

    if (!normalizedCode) {
      res.status(400).json({ message: "Código QR inválido" });
      return;
    }

    const userCoupon = await UserCoupon.findById(normalizedCode)
      .populate({ path: "couponId", model: "Coupon" })
      .populate({ path: "userId", model: "User" });

    if (!userCoupon) {
      res.status(404).json({ message: "Cupón no encontrado" });
      return;
    }

    const couponDoc = userCoupon.couponId as any;

    if (!couponDoc) {
      res.status(404).json({ message: "Cupón asociado no disponible" });
      return;
    }

    const couponStoreId =
      typeof couponDoc.storeId === "object" && couponDoc.storeId !== null
        ? couponDoc.storeId.toString()
        : couponDoc.storeId?.toString();

    if (!couponStoreId || couponStoreId !== storeUser._id.toString()) {
      res.status(403).json({ message: "Este cupón no pertenece a tu tienda" });
      return;
    }

    const now = new Date();
    if (couponDoc.expirationDate && new Date(couponDoc.expirationDate) < now) {
      res.status(410).json({ message: "Este cupón ha expirado" });
      return;
    }

    if (userCoupon.status === "used") {
      res.status(409).json({ message: "Este cupón ya fue utilizado" });
      return;
    }

    userCoupon.status = "used";
    userCoupon.usedDate = new Date();
    await userCoupon.save();

    res.json({
      message: "Cupón canjeado correctamente",
      redemption: {
        id: userCoupon._id,
        status: userCoupon.status,
        usedDate: userCoupon.usedDate,
        coupon: {
          id: couponDoc._id,
          name: couponDoc.name,
          description: couponDoc.description,
          tokensRequired: couponDoc.tokensRequired,
        },
        user:
          userCoupon.userId && typeof userCoupon.userId === "object"
            ? {
                id: (userCoupon.userId as any)._id,
                name: (userCoupon.userId as any).name,
                email: (userCoupon.userId as any).email,
              }
            : undefined,
      },
    });
    return;
  } catch (error) {
    console.error("Error al canjear cupón escaneado:", error);
    res.status(500).json({ message: "Error al procesar el cupón" });
    return;
  }
};