import { Request, Response } from "express";
import tokenService from "../services/tokenService";
import User from "../models/user";
import TokenTransaction from "../models/tokenTransaction";
import { CustomError } from "../utils/errors"; // Import CustomError base class

export const transferTokens = async (req: Request, res: Response) => {
  const senderId = (req as any).user?._id;
  const { receiverIdentifier, amount, requestId } = req.body; // Receive requestId

  if (!senderId || !receiverIdentifier || typeof amount !== "number") {
    return res.status(400).json({ message: "Faltan datos requeridos: receiverIdentifier, amount." });
  }

  // Basic validation on requestId format if desired (e.g., UUID format)
  if (requestId && (typeof requestId !== 'string' || requestId.length === 0)) {
    return res.status(400).json({ message: "Formato de requestId inválido." });
  }

  if (amount <= 0) {
    return res.status(400).json({ message: "El monto a transferir debe ser positivo." });
  }

  try {
    const transaction = await tokenService.transferTokens({
      senderId: senderId.toString(),
      receiverIdentifier,
      amount,
      requestId, // Pass requestId to service
    });

    const updatedSender = await User.findById(senderId);

    if (!updatedSender) {
      console.warn(`transferTokens: Sender with ID ${senderId} not found after successful transaction.`);
      return res.status(500).json({
        message: "Transferencia de tokens exitosa, pero no se pudo obtener el saldo actualizado del remitente.",
        transactionId: transaction._id,
      });
    }

    res.status(200).json({
      message: "Transferencia de tokens exitosa.",
      transactionId: transaction._id,
      newSenderTokens: updatedSender.tokens,
    });
  } catch (error: any) {
    // Handle custom errors for specific HTTP responses
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en transferTokens controller:", error);
    res.status(500).json({ message: "Error al transferir tokens." });
  }
};

export const getUserTokenTransactions = async (
  req: Request,
  res: Response,
) => {
  const userId = (req as any).user?._id;

  if (!userId) {
    return res.status(401).json({ message: "No autenticado." });
  }

  try {
    const transactions = await tokenService.getUserTransactions(
      userId.toString(),
    );
    res.status(200).json(transactions);
  } catch (error: any) {
    // This endpoint typically just fetches, so less custom error handling needed
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en getUserTokenTransactions controller:", error);
    res.status(500).json({ message: "Error al obtener el historial de transacciones." });
  }
};

// --- ADMIN CONTROLLERS Conceptual, not registered in routes yet---

export const adminAdjustUserTokens = async (req: Request, res: Response) => {
  const adminId = (req as any).user?._id; // Assuming admin ID is available from auth
  const { userId, amount, description } = req.body;

  if (!adminId) {
    return res.status(401).json({ message: "No autenticado como administrador." });
  }
  if (!userId || typeof amount !== "number") {
    return res.status(400).json({ message: "Faltan datos requeridos: userId, amount." });
  }

  try {
    const updatedUser = await tokenService.adminAdjustTokens({
      userId,
      amount,
      description,
      adminId: adminId.toString(),
    });
    res.status(200).json({
      message: "Tokens del usuario ajustados correctamente.",
      userId: updatedUser._id,
      newBalance: updatedUser.tokens,
    });
  } catch (error: any) {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en adminAdjustUserTokens controller:", error);
    res.status(500).json({ message: "Error al ajustar tokens del usuario." });
  }
};

export const adminUpdateTransactionStatus = async (
  req: Request,
  res: Response,
) => {
  const adminId = (req as any).user?._id;
  const { transactionId } = req.params; // Transaction ID from URL param
  const { status, reason } = req.body;

  if (!adminId) {
    return res.status(401).json({ message: "No autenticado como administrador." });
  }
  if (!status || !transactionId) {
    return res.status(400).json({ message: "Faltan datos requeridos: transactionId, status." });
  }
  // Validate status to be one of the enum values
  const validStatuses = ["completed", "failed", "cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: "Estado de transacción inválido." });
  }

  try {
    const updatedTransaction = await tokenService.adminUpdateTransactionStatus({
      transactionId,
      status,
      adminId: adminId.toString(),
      reason,
    });
    res.status(200).json({
      message: "Estado de transacción actualizado correctamente.",
      transaction: updatedTransaction,
    });
  } catch (error: any) {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en adminUpdateTransactionStatus controller:", error);
    res.status(500).json({ message: "Error al actualizar estado de transacción." });
  }
};

// Get all transactions for admin view
export const adminGetAllTransactions = async (req: Request, res: Response) => {
    const adminId = (req as any).user?._id; // For admin check

    if (!adminId) {
        return res.status(401).json({ message: "No autenticado como administrador." });
    }

    try {
        const transactions = await TokenTransaction.find({})
            .populate("senderId", "name email")
            .populate("receiverId", "name email")
            .sort({ createdAt: -1 });
        res.status(200).json(transactions);
    } catch (error: any) {
        console.error("Error en adminGetAllTransactions controller:", error);
        res.status(500).json({ message: "Error al obtener todas las transacciones." });
    }
};