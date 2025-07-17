import { Request, Response } from "express";
import tokenService from "../services/tokenService";
import User from "../models/user"; // Import the User model

export const transferTokens = async (req: Request, res: Response) => {
  const senderId = (req as any).user?._id;
  const { receiverIdentifier, amount } = req.body;

  if (!senderId || !receiverIdentifier || typeof amount !== "number") {
    return res.status(400).json({ message: "Faltan datos requeridos: receiverIdentifier, amount." });
  }

  if (amount <= 0) {
    return res.status(400).json({ message: "El monto a transferir debe ser positivo." });
  }

  try {
    const transaction = await tokenService.transferTokens({
      senderId: senderId.toString(),
      receiverIdentifier,
      amount,
    });

    // After a successful transaction, re-fetch the sender's user document
    // to get the most up-to-date token balance.
    const updatedSender = await User.findById(senderId);

    if (!updatedSender) {
      // This case should ideally not happen if senderId was valid at the start
      // but it's good for robustness.
      console.warn(`transferTokens: Sender with ID ${senderId} not found after successful transaction.`);
      return res.status(500).json({
        message: "Transferencia de tokens exitosa, pero no se pudo obtener el saldo actualizado del remitente.",
        transactionId: transaction._id,
      });
    }

    res.status(200).json({
      message: "Transferencia de tokens exitosa.",
      transactionId: transaction._id,
      newSenderTokens: updatedSender.tokens, // Use the tokens from the re-fetched user
    });
  } catch (error: any) {
    console.error("Error en transferTokens controller:", error.message);
    res.status(500).json({ message: error.message || "Error al transferir tokens." });
  }
};

/**
 * Retrieves the token transaction history for the authenticated user.
 * 
 * Responds with a list of transactions where the user is either the sender or receiver.
 * If the user is not authenticated, returns a 401 status.
 * 
 * @param {Request} req - The HTTP request object, containing user information from authentication middleware.
 * @param {Response} res - The HTTP response object used to send the response.
 */
export const getUserTokenTransactions = async (
  req: Request,
  res: Response,
) => {
  const userId = (req as any).user?._id; // Assuming user ID is from authentication middleware

  if (!userId) {
    return res.status(401).json({ message: "No autenticado." });
  }

  try {
    const transactions = await tokenService.getUserTransactions(
      userId.toString(),
    );
    res.status(200).json(transactions);
  } catch (error: any) {
    console.error("Error en getUserTokenTransactions controller:", error.message);
    res.status(500).json({ message: "Error al obtener el historial de transacciones." });
  }
};