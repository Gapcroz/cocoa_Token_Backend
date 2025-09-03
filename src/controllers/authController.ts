import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user";
import moment from "moment";
import isAdmin from "../utils/firebase";
import logger from "../utils/logger";

const JWT_SECRET = process.env.JWT_SECRET || "mi_clave_secreta_super_segura";

export const register = async (req: Request, res: Response) => {
  // Log para depuración: mostrar el body recibido
  logger.info("Body recibido en registro:", req.body);

  const { name, address, birthDate, email, password, isStore, isAdmin } =
    req.body;
  logger.info("Register: Received request to register user:", {
    email,
    isStore,
    isAdmin,
  });
  // NUEVO LOG para depuración
  logger.info(
    "[DEBUG] Valor recibido de isAdmin:",
    isAdmin,
    "Tipo:",
    typeof isAdmin
  );

  try {
    logger.info("Register: Checking if user already exists for email:", email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ message: "El usuario ya existe." });
      return;
    }

    // Verificar si ya existe un admin y si el usuario que se registra es admin
    if (isAdmin === true) {
      const existingAdmin = await User.findOne({ isAdmin: true });
      if (existingAdmin) {
        res.status(403).json({
          message:
            "Ya existe un administrador en el sistema. No se pueden registrar más administradores.",
        });
        return;
      }
    }

    logger.info("Register: Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);
    logger.info("Register: Password hashed successfully.");

    let parsedDate: Date | null = null;
    if (!isStore) {
      logger.warn(
        "Register: User is not a store, parsing birthDate:",
        birthDate
      );
      const formattedDate = moment(
        birthDate,
        ["DD/MM/YYYY", "YYYY-MM-DD"],
        true
      );
      if (!formattedDate.isValid()) {
        res.status(400).json({ message: "Fecha de nacimiento inválida" });
        return;
      }
      parsedDate = formattedDate.toDate();
      logger.info("Register: BirthDate parsed successfully to:", parsedDate);
    } else {
      logger.warn("Register: User is a store, birthDate is not required.");
    }

    logger.info("Register: Creating new User instance...");
    const newUser = new User({
      name,
      address,
      birthDate: parsedDate,
      email,
      password: hashedPassword,
      isStore: isStore || false,
      isAdmin: isAdmin || false,
    });
    logger.info("Register: New User instance created:", newUser);

    logger.info("Register: Saving new user to database...");
    await newUser.save();
    logger.info("Register: User saved successfully to database.");

    res.status(201).json({
      message: "Usuario creado correctamente",
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      address: newUser.address,
      birthDate: newUser.birthDate,
      isStore: newUser.isStore,
      isAdmin: newUser.isAdmin,
      tokens: newUser.tokens,
    });
    logger.info("Register: User registered successfully, response sent.");
    return;
  } catch (err) {
    logger.error("Register: Server error during registration:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
};

export const login = async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;
  logger.info("Login: Received request to login user with email:", email);

  try {
    logger.info("Login: Searching for user with email:", email);
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn("Login: User not found for email:", email);
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    logger.info("Login: User found:", user.email);
    logger.info("Login: User document from DB:", user);

    if (!user.password) {
      logger.info(
        "Login: User password is null, profile not completed for:",
        email
      );
      return res.status(400).json({
        message: "Este usuario aún no ha completado su perfil",
      });
    }

    logger.info("Login: Comparing provided password with stored password...");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn("Login: Incorrect password for user:", email);
      res.status(401).json({ message: "Contraseña incorrecta" });
      return;
    }
    logger.info("Login: Password matched successfully.");

    logger.info("Login: Generating JWT token for userId:", user._id);
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });
    logger.info("Login: JWT token generated successfully.");

    const responseData = {
      message: "Login exitoso",
      token,
      userId: user._id,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        address: user.address,
        birthDate: user.birthDate,
        isStore: user.isStore,
        isAdmin: user.isAdmin,
        tokens: user.tokens,
      },
    };
    logger.info(
      "Login: Response data being sent:",
      JSON.stringify(responseData, null, 2)
    );

    res.json(responseData);
    logger.info("Login: User logged in successfully, response sent.");
    return;
  } catch (err) {
    logger.error("Login: Server error during login:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
};

export const googleLogin = async (req: Request, res: Response) => {
  const { idToken } = req.body;
  logger.info("GoogleLogin: Received request for Google login.");

  try {
    logger.info("GoogleLogin: Verifying Google ID token...");
    const decodedToken = await isAdmin.auth().verifyIdToken(idToken);
    const { email, name } = decodedToken;
    logger.info("GoogleLogin: Google ID token verified, decoded email:", email);

    logger.info("GoogleLogin: Checking if user exists for email:", email);
    let user = await User.findOne({ email });

    if (!user) {
      logger.warn(
        "GoogleLogin: User not found, creating new user for email:",
        email
      );
      user = new User({
        name,
        email,
        address: "",
        password: "",
        birthDate: null,
        isStore: false,
      });
      logger.info(
        "GoogleLogin: New user instance created, saving to database..."
      );
      await user.save();
      logger.info("GoogleLogin: New user saved successfully.");
    } else {
      logger.info("GoogleLogin: User found for email:", email);
    }

    logger.info("GoogleLogin: Generating JWT token for userId:", user._id);
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "7d",
    });
    logger.info("GoogleLogin: JWT token generated successfully.");

    res.json({
      message: "Login con Google exitoso",
      token,
      userId: user._id,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        address: user.address,
        birthDate: user.birthDate,
        isStore: user.isStore,
        isAdmin: user.isAdmin,
        tokens: user.tokens,
      },
    });
    logger.info("GoogleLogin: Google login successful, response sent.");
    return;
  } catch (error) {
    logger.error("GoogleLogin: Error in Google login:", error);
    res.status(401).json({ message: "Token de Google inválido o expirado" });
  }
};

export const completeGoogleUser = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { userId, password, isStore, birthDate } = req.body;
  logger.info(
    "CompleteGoogleUser: Received request to complete user profile for userId:",
    userId
  );

  if (
    !userId ||
    !password ||
    typeof isStore === "undefined" ||
    typeof isAdmin === "undefined"
  ) {
    logger.warn("CompleteGoogleUser: Missing required fields in request.");
    res.status(400).json({ message: "Faltan campos obligatorios" });
    return;
  }

  try {
    logger.info("CompleteGoogleUser: Searching for user with userId:", userId);
    const user = await User.findById(userId);

    if (!user) {
      logger.warn("CompleteGoogleUser: User not found for userId:", userId);
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    logger.info("CompleteGoogleUser: User found:", user.email);

    if (user.password) {
      logger.info(
        "CompleteGoogleUser: User profile already completed for userId:",
        userId
      );
      res.status(400).json({ message: "El perfil ya fue completado" });
      return;
    }
    logger.warn(
      "CompleteGoogleUser: User profile not yet completed, proceeding."
    );

    logger.info("CompleteGoogleUser: Hashing new password...");
    const hashedPassword = await bcrypt.hash(password, 10);
    logger.info("CompleteGoogleUser: Password hashed successfully.");

    let parsedDate: Date | null = null;
    if (!isStore && birthDate) {
      logger.info(
        "CompleteGoogleUser: User is not a store and birthDate provided, parsing:",
        birthDate
      );
      const formattedDate = moment(birthDate, ["YYYY-MM-DD", "DD/MM/YYYY"]);
      if (!formattedDate.isValid()) {
        logger.warn(
          "CompleteGoogleUser: Invalid birthDate provided:",
          birthDate
        );
        // You might want to send a 400 here if you want to enforce strict date format
        // For now, it will just assign null if invalid.
      } else {
        parsedDate = formattedDate.toDate();
        logger.info(
          "CompleteGoogleUser: BirthDate parsed successfully to:",
          parsedDate
        );
      }
    } else {
      logger.warn(
        "CompleteGoogleUser: User is a store or no birthDate provided."
      );
    }

    logger.info("CompleteGoogleUser: Assigning updated fields to user object.");
    Object.assign(user, {
      password: hashedPassword,
      isStore,
      isAdmin,
      birthDate: parsedDate,
    });

    logger.info(
      "CompleteGoogleUser: Saving updated user profile to database..."
    );
    await user.save();
    logger.info("CompleteGoogleUser: User profile saved successfully.");

    res.status(200).json({ message: "Perfil completado correctamente" });
    logger.info(
      "CompleteGoogleUser: Profile completed successfully, response sent."
    );
    return;
  } catch (err) {
    logger.error("CompleteGoogleUser: Error in completeGoogleUser:", err);
    res.status(500).json({ message: "Error del servidor" });
  }
};

// Verificar si ya existe un administrador
export const checkAdminExists = async (req: Request, res: Response) => {
  try {
    logger.info("CheckAdminExists: Checking if admin exists in system...");
    const isExistingAdmin = await User.findOne({ isAdmin: true });

    if (isExistingAdmin) {
      logger.info("CheckAdminExists: Admin found in system");
      res.json({
        exists: true,
        message: "Ya existe un administrador en el sistema",
      });
    } else {
      logger.info("CheckAdminExists: No admin found in system");
      res.json({
        exists: false,
        message: "No hay administrador registrado",
      });
    }
    return;
  } catch (err) {
    logger.error("CheckAdminExists: Server error:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// Obtener datos del usuario autenticado
export const getMe = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      address: user.address,
      birthDate: user.birthDate,
      isStore: user.isStore,
      isAdmin: user.isAdmin,
      tokens: user.tokens,
    });
    return;
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el usuario" });
    return;
  }
};

// Update user data authenticated
export const updateProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const { name, address, birthDate, isStore } = req.body;
    logger.info(`Solicitud de actualización de perfil recibida`);

    const updateData: any = {};

    if (name?.trim()) updateData.name = name;
    if (address?.trim()) updateData.address = address;
    if (typeof isStore === "boolean") updateData.isStore = isStore;

    if (birthDate) {
      const formattedDate = moment(birthDate, ["YYYY-MM-DD", "DD/MM/YYYY"]);
      if (!formattedDate.isValid()) {
        logger.warn(`Fecha de nacimiento inválida : ${birthDate}`);
        res.status(400).json({ message: "Fecha de nacimiento inválida" });
      }
      updateData.birthDate = formattedDate.toDate();
    }
    logger.info(`Datos a actualizar: ${JSON.stringify(updateData)}`);
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      logger.warn(`Usuario no encontrado`);
      res.status(404).json({ message: "Usuario no encontrado" });
    }
    logger.info(`Perfil actualizado correctamente`);
    res.json({
      message: "Perfil actualizado correctamente",
      user: updatedUser,
    });
  } catch (error) {
    logger.error("updateProfile: Error al actualizar perfil:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const { currentPassword, newPassword } = req.body;

    logger.info("ChangePassword: Petición recibida para cambiar contraseña del usuario:", userId);

    if (!currentPassword || !newPassword) {
      logger.warn("ChangePassword: Campos faltantes en la solicitud.");
      res.status(400).json({ message: "Contraseña actual y nueva son requeridas." });
      return;
    }

    const user = await User.findById(userId);
    if (!user || !user.password) {
      logger.warn("ChangePassword: Usuario no encontrado o sin contraseña definida:", userId);
      res.status(404).json({ message: "Usuario no encontrado o no tiene contraseña establecida." });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      logger.warn("ChangePassword: Contraseña actual incorrecta para el usuario:", user.email);
      res.status(401).json({ message: "La contraseña actual es incorrecta." });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();
    logger.info("ChangePassword: Contraseña actualizada correctamente para el usuario:", user.email);

    res.json({ message: "Contraseña actualizada exitosamente." });
  } catch (error) {
    logger.error("ChangePassword: Error al cambiar la contraseña:", error);
    res.status(500).json({ message: "Error del servidor al cambiar la contraseña." });
  }
};
