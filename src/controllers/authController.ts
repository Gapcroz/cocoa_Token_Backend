import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user";
import moment from "moment";
import admin from "../utils/firebase";

const JWT_SECRET = process.env.JWT_SECRET || "mi_clave_secreta_super_segura";

export const register = async (req: Request, res: Response) => {
  const { name, address, birthDate, email, password, isStore } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      res.status(409).json({ message: "El usuario ya existe." });

    const hashedPassword = await bcrypt.hash(password, 10);

    let parsedDate: Date | null = null;
    if (!isStore) {
      const formattedDate = moment(
        birthDate,
        ["DD/MM/YYYY", "YYYY-MM-DD"],
        true
      );
      if (!formattedDate.isValid()) {
        res.status(400).json({ message: "Fecha de nacimiento inválida" });
      }
      parsedDate = formattedDate.toDate();
    }

    const newUser = new User({
      name,
      address,
      birthDate: parsedDate,
      email,
      password: hashedPassword,
      isStore: isStore || false,
    });

    await newUser.save();

    res.status(201).json({
      message: "Usuario creado correctamente",
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      address: newUser.address,
      birthDate: newUser.birthDate,
      isStore: newUser.isStore,
    });
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    if (!user.password) {
      res.status(400).json({
        message: "Este usuario aún no ha completado su perfil",
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: "Contraseña incorrecta" });
      return;
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      message: "Login exitoso",
      token,
      userId: user._id,
      user,
    });
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};

export const googleLogin = async (req: Request, res: Response) => {
  const { idToken } = req.body;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name } = decodedToken;

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name,
        email,
        address: "",
        password: "",
        birthDate: null,
        isStore: false,
      });
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "Login con Google exitoso",
      token,
      userId: user._id,
      user,
    });
  } catch (error) {
    console.error("Error en login con Google:", error);
    res.status(401).json({ message: "Token de Google inválido o expirado" });
  }
};

export const completeGoogleUser = async (req: Request, res: Response) => {
  const { userId, password, isStore, birthDate } = req.body;

  if (!userId || !password || typeof isStore === "undefined") {
    res.status(400).json({ message: "Faltan campos obligatorios" });
    return;
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    if (user.password) {
      res.status(400).json({ message: "El perfil ya fue completado" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const parsedDate =
      !isStore && birthDate
        ? moment(birthDate, ["YYYY-MM-DD", "DD/MM/YYYY"]).toDate()
        : null;

    Object.assign(user, {
      password: hashedPassword,
      isStore,
      birthDate: parsedDate,
    });

    await user.save();

    res.status(200).json({ message: "Perfil completado correctamente" });
    return;
  } catch (err) {
    console.error("Error en completeGoogleUser:", err);
    res.status(500).json({ message: "Error del servidor" });
    return;
  }
};
