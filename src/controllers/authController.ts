import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user";
import moment from "moment";
import admin from "../utils/firebase";

const JWT_SECRET = process.env.JWT_SECRET || "mi_clave_secreta_super_segura";

export const register = async (req: Request, res: Response) => {
  // Log para depuración: mostrar el body recibido
  console.log('Body recibido en registro:', req.body);

  const { name, address, birthDate, email, password, isStore, isAdmin } = req.body;
  console.log("Register: Received request to register user:", {
    email,
    isStore,
    isAdmin,
  });

  try {
    console.log("Register: Checking if user already exists for email:", email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ message: "El usuario ya existe." });
      return;
    }

    // Verificar si ya existe un admin y si el usuario que se registra no es admin
    if (isAdmin === false || isAdmin === undefined) {
      const existingAdmin = await User.findOne({ isAdmin: true });
      if (existingAdmin) {
        res.status(403).json({ 
          message: "Ya existe un administrador en el sistema. No se pueden registrar más usuarios." 
        });
        return;
      }
    }

    console.log("Register: Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Register: Password hashed successfully.");

    let parsedDate: Date | null = null;
    if (!isStore) {
      console.log("Register: User is not a store, parsing birthDate:", birthDate);
      const formattedDate = moment(
        birthDate,
        ["DD/MM/YYYY", "YYYY-MM-DD"],
        true,
      );
      if (!formattedDate.isValid()) {
        res.status(400).json({ message: "Fecha de nacimiento inválida" });
        return;
      }
      parsedDate = formattedDate.toDate();
      console.log("Register: BirthDate parsed successfully to:", parsedDate);
    } else {
      console.log("Register: User is a store, birthDate is not required.");
    }

    console.log("Register: Creating new User instance...");
    const newUser = new User({
      name,
      address,
      birthDate: parsedDate,
      email,
      password: hashedPassword,
      isStore: isStore || false,
      isAdmin: isAdmin || false,
    });
    console.log("Register: New User instance created:", newUser);

    console.log("Register: Saving new user to database...");
    await newUser.save();
    console.log("Register: User saved successfully to database.");

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
    console.log("Register: User registered successfully, response sent.");
    return;
  } catch (err) {
    console.error("Register: Server error during registration:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  console.log("Login: Received request to login user with email:", email);

  try {
    console.log("Login: Searching for user with email:", email);
    const user = await User.findOne({ email });
    if (!user) {
      console.log("Login: User not found for email:", email);
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    console.log("Login: User found:", user.email);
    console.log("Login: User document from DB:", user);

    if (!user.password) {
      console.log("Login: User password is null, profile not completed for:", email);
      res.status(400).json({
        message: "Este usuario aún no ha completado su perfil",
      });
      return;
    }

    console.log("Login: Comparing provided password with stored password...");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Login: Incorrect password for user:", email);
      res.status(401).json({ message: "Contraseña incorrecta" });
      return;
    }
    console.log("Login: Password matched successfully.");

    console.log("Login: Generating JWT token for userId:", user._id);
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });
    console.log("Login: JWT token generated successfully.");

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
    console.log("Login: Response data being sent:", JSON.stringify(responseData, null, 2));

    res.json(responseData);
    console.log("Login: User logged in successfully, response sent.");
    return;
  } catch (err) {
    console.error("Login: Server error during login:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
};

export const googleLogin = async (req: Request, res: Response) => {
  const { idToken } = req.body;
  console.log("GoogleLogin: Received request for Google login.");

  try {
    console.log("GoogleLogin: Verifying Google ID token...");
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name } = decodedToken;
    console.log("GoogleLogin: Google ID token verified, decoded email:", email);

    console.log("GoogleLogin: Checking if user exists for email:", email);
    let user = await User.findOne({ email });

    if (!user) {
      console.log("GoogleLogin: User not found, creating new user for email:", email);
      user = new User({
        name,
        email,
        address: "",
        password: "",
        birthDate: null,
        isStore: false,
      });
      console.log("GoogleLogin: New user instance created, saving to database...");
      await user.save();
      console.log("GoogleLogin: New user saved successfully.");
    } else {
      console.log("GoogleLogin: User found for email:", email);
    }

    console.log("GoogleLogin: Generating JWT token for userId:", user._id);
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "7d",
    });
    console.log("GoogleLogin: JWT token generated successfully.");

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
    console.log("GoogleLogin: Google login successful, response sent.");
    return;
  } catch (error) {
    console.error("GoogleLogin: Error in Google login:", error);
    res.status(401).json({ message: "Token de Google inválido o expirado" });
  }
};

export const completeGoogleUser = async (req: Request, res: Response) => {
  const { userId, password, isStore, isAdmin, birthDate } = req.body;
  console.log("CompleteGoogleUser: Received request to complete user profile for userId:", userId);

  if (!userId || !password || typeof isStore === "undefined" || typeof isAdmin === "undefined") {
    console.log("CompleteGoogleUser: Missing required fields in request.");
    res.status(400).json({ message: "Faltan campos obligatorios" });
    return;
  }

  try {
    console.log("CompleteGoogleUser: Searching for user with userId:", userId);
    const user = await User.findById(userId);

    if (!user) {
      console.log("CompleteGoogleUser: User not found for userId:", userId);
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    console.log("CompleteGoogleUser: User found:", user.email);

    if (user.password) {
      console.log("CompleteGoogleUser: User profile already completed for userId:", userId);
      res.status(400).json({ message: "El perfil ya fue completado" });
      return;
    }
    console.log("CompleteGoogleUser: User profile not yet completed, proceeding.");

    console.log("CompleteGoogleUser: Hashing new password...");
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("CompleteGoogleUser: Password hashed successfully.");

    let parsedDate: Date | null = null;
    if (!isStore && birthDate) {
      console.log("CompleteGoogleUser: User is not a store and birthDate provided, parsing:", birthDate);
      const formattedDate = moment(birthDate, ["YYYY-MM-DD", "DD/MM/YYYY"]);
      if (!formattedDate.isValid()) {
        console.log("CompleteGoogleUser: Invalid birthDate provided:", birthDate);
        // You might want to send a 400 here if you want to enforce strict date format
        // For now, it will just assign null if invalid.
      } else {
        parsedDate = formattedDate.toDate();
        console.log("CompleteGoogleUser: BirthDate parsed successfully to:", parsedDate);
      }
    } else {
      console.log("CompleteGoogleUser: User is a store or no birthDate provided.");
    }

    console.log("CompleteGoogleUser: Assigning updated fields to user object.");
    Object.assign(user, {
      password: hashedPassword,
      isStore,
      isAdmin,
      birthDate: parsedDate,
    });

    console.log("CompleteGoogleUser: Saving updated user profile to database...");
    await user.save();
    console.log("CompleteGoogleUser: User profile saved successfully.");

    res.status(200).json({ message: "Perfil completado correctamente" });
    console.log("CompleteGoogleUser: Profile completed successfully, response sent.");
    return;
  } catch (err) {
    console.error("CompleteGoogleUser: Error in completeGoogleUser:", err);
    res.status(500).json({ message: "Error del servidor" });
  }
};

// Verificar si ya existe un administrador
export const checkAdminExists = async (req: Request, res: Response) => {
  try {
    console.log("CheckAdminExists: Checking if admin exists in system...");
    const existingAdmin = await User.findOne({ isAdmin: true });
    
    if (existingAdmin) {
      console.log("CheckAdminExists: Admin found in system");
      res.json({ 
        exists: true, 
        message: "Ya existe un administrador en el sistema" 
      });
    } else {
      console.log("CheckAdminExists: No admin found in system");
      res.json({ 
        exists: false, 
        message: "No hay administrador registrado" 
      });
    }
    return;
  } catch (err) {
    console.error("CheckAdminExists: Server error:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
};

// Obtener datos del usuario autenticado
export const getMe = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ message: 'No autenticado' });
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
    res.status(500).json({ message: 'Error al obtener el usuario' });
    return;
  }
};
