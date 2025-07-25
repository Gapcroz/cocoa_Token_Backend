// src/controllers/tokenController.ts
import { Request, Response } from "express";
import tokenService from "../services/tokenService";
import User from "../models/user";
import TokenTransaction from "../models/tokenTransaction";
import { CustomError } from "../utils/errors"; // Import CustomError base class

/**
 * Endpoint to initiate a token transfer request.
 * Funds are reserved from the sender upon successful request.
 */
export const requestTransfer = async (req: Request, res: Response) => {
  const senderId = (req as any).user?._id;
  const { receiverIdentifier, amount, requestId } = req.body; // Receive requestId for idempotency

  if (!senderId || !receiverIdentifier || typeof amount !== "number") {
    return res.status(400).json({
      message: "Faltan datos requeridos: receiverIdentifier, amount.",
    });
  }

  // Basic validation on requestId format if desired (e.g., UUID format)
  if (requestId && (typeof requestId !== "string" || requestId.length === 0)) {
    return res.status(400).json({ message: "Formato de requestId inválido." });
  }

  if (amount <= 0) {
    return res
      .status(400)
      .json({ message: "El monto a transferir debe ser positivo." });
  }

  try {
    const transaction = await tokenService.requestTransfer({
      senderId: senderId.toString(),
      receiverIdentifier,
      amount,
      requestId, // Pass requestId to service
    });

    // Fetch updated sender balance after the reservation
    const updatedSender = await User.findById(senderId);

    // 202 Accepted indicates that the request has been accepted for processing, but the processing is not yet complete.
    // In this case, it's "pending acceptance" by the receiver.
    res.status(202).json({
      message:
        "Solicitud de transferencia enviada. Pendiente de aceptación del destinatario.",
      transactionId: transaction._id,
      transactionStatus: transaction.status,
      newSenderTokens: updatedSender ? updatedSender.tokens : undefined, // Provide updated balance for feedback
    });
  } catch (error: any) {
    // Handle custom errors for specific HTTP responses
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en requestTransfer controller:", error);
    res.status(500).json({ message: "Error al solicitar la transferencia." });
  }
};

/**
 * Endpoint for the receiver to accept a pending token transfer request.
 */
export const acceptTransfer = async (req: Request, res: Response) => {
  const receiverId = (req as any).user?._id;
  const { transactionId } = req.params; // Get transaction ID from URL parameter

  if (!receiverId || !transactionId) {
    return res
      .status(400)
      .json({ message: "Faltan datos requeridos: transactionId." });
  }

  try {
    const transaction = await tokenService.acceptTransfer({
      transactionId,
      receiverId: receiverId.toString(),
    });

    // Fetch updated receiver balance after the acceptance
    const updatedReceiver = await User.findById(receiverId);

    res.status(200).json({
      message: "Transferencia de tokens aceptada y completada.",
      transactionId: transaction._id,
      transactionStatus: transaction.status,
      newReceiverTokens: updatedReceiver ? updatedReceiver.tokens : undefined, // Provide updated balance
    });
  } catch (error: any) {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en acceptTransfer controller:", error);
    res
      .status(500)
      .json({ message: "Error al aceptar la transferencia de tokens." });
  }
};

/**
 * Endpoint for the receiver to reject a pending token transfer request.
 */
export const rejectTransfer = async (req: Request, res: Response) => {
  const receiverId = (req as any).user?._id;
  const { transactionId } = req.params; // Get transaction ID from URL parameter
  const { reason } = req.body; // Optional reason for rejection

  if (!receiverId || !transactionId) {
    return res
      .status(400)
      .json({ message: "Faltan datos requeridos: transactionId." });
  }

  try {
    const transaction = await tokenService.rejectTransfer({
      transactionId,
      receiverId: receiverId.toString(),
      reason,
    });

    // Fetch original sender's updated balance after funds are returned
    const updatedSender = await User.findById(transaction.senderId);

    res.status(200).json({
      message:
        "Solicitud de transferencia rechazada. Fondos devueltos al remitente.",
      transactionId: transaction._id,
      transactionStatus: transaction.status,
      newSenderTokens: updatedSender ? updatedSender.tokens : undefined, // Provide updated sender balance
    });
  } catch (error: any) {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en rejectTransfer controller:", error);
    res
      .status(500)
      .json({ message: "Error al rechazar la transferencia de tokens." });
  }
};

/**
 * Endpoint for an admin to cancel a previously completed token transfer.
 * Funds are reverted, and a cooldown period is applied to the original sender's tokens.
 * This should be used for explicit chargeback-like scenarios.
 */
export const cancelTransfer = async (req: Request, res: Response) => {
  const adminId = (req as any).user?._id; // Assuming admin ID is available from auth
  const { transactionId } = req.params; // Transaction ID from URL param
  const { reason } = req.body; // Required reason for cancellation

  if (!adminId) {
    return res
      .status(401)
      .json({ message: "No autenticado como administrador." });
  }
  if (!transactionId || !reason) {
    return res
      .status(400)
      .json({ message: "Faltan datos requeridos: transactionId, reason." });
  }

  try {
    const cancellationTransaction = await tokenService.cancelTokens({
      transactionId,
      adminId: adminId.toString(),
      reason,
    });

    // Fetch updated balances of original sender/receiver for response feedback
    const originalTransaction = await TokenTransaction.findById(transactionId);
    const originalSender = originalTransaction?.senderId
      ? await User.findById(originalTransaction.senderId)
      : null;
    const originalReceiver = originalTransaction?.receiverId
      ? await User.findById(originalTransaction.receiverId)
      : null;

    res.status(200).json({
      message: "Transacción cancelada y fondos revertidos.",
      originalTransactionId: transactionId,
      newCancellationTransactionId: cancellationTransaction._id,
      originalTransactionStatus: originalTransaction?.status,
      originalSenderNewBalance: originalSender?.tokens,
      originalReceiverNewBalance: originalReceiver?.tokens,
      cooldownUntil: originalSender?.lastCancelledTransferCooldownUntil, // Provide cooldown info
    });
  } catch (error: any) {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en cancelTransfer controller:", error);
    res.status(500).json({ message: "Error al cancelar la transferencia." });
  }
};

/**
 * Endpoint to get a user's token transaction history.
 */
export const getUserTokenTransactions = async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;

  if (!userId) {
    return res.status(401).json({ message: "No autenticado." });
  }

  try {
    const transactions = await tokenService.getUserTransactions(
      userId.toString()
    );
    res.status(200).json(transactions);
  } catch (error: any) {
    // This endpoint typically just fetches, so less custom error handling needed
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en getUserTokenTransactions controller:", error);
    res
      .status(500)
      .json({ message: "Error al obtener el historial de transacciones." });
  }
};

/**
 * Endpoint to obtain all transfer requests sent by the user and pending acceptance
 */
export const getPendingTransferRequestsSent = async (
  req: Request,
  res: Response
) => {
  const userId = (req as any).user?._id;

  if (!userId) {
    return res.status(401).json({ message: "No autenticado." });
  }

  try {
    const sentRequests = await tokenService.getPendingTransferRequestsSent(
      userId.toString()
    );
    res.status(200).json(sentRequests);
  } catch (error: any) {
    console.error("Error en getPendingTransferRequestsSent controller:", error);
    res.status(500).json({ message: "Error al obtener solicitudes enviadas." });
  }
};

/**
 * Endpoint to obtain all transfer requests received by the user and that are pending acceptance.
 */
export const getPendingTransferRequestsReceived = async (
  req: Request,
  res: Response
) => {
  const userId = (req as any).user?._id;

  if (!userId) {
    return res.status(401).json({ message: "No autenticado." });
  }

  try {
    const receivedRequests =
      await tokenService.getPendingTransferRequestsReceived(userId.toString());
    res.status(200).json(receivedRequests);
  } catch (error: any) {
    console.error(
      "Error en getPendingTransferRequestsReceived controller:",
      error
    );
    res
      .status(500)
      .json({ message: "Error al obtener solicitudes recibidas." });
  }
};

/**
 * Endpoint to obtain all cancellation requests submitted by the user.
 */
export const getUserCancellationRequests = async (
  req: Request,
  res: Response
) => {
  const userId = (req as any).user?._id;

  if (!userId) {
    return res.status(401).json({ message: "No autenticado." });
  }

  try {
    const requests = await tokenService.getUserCancellationRequests(
      userId.toString()
    );
    res.status(200).json(requests);
  } catch (error: any) {
    console.error("Error en getUserCancellationRequests controller:", error);
    res.status(500).json({
      message: "Error al obtener solicitudes de cancelación del usuario.",
    });
  }
};

/**
 * Endpoint for a user to create a request to cancel a completed transaction.
 */
export const createCancellationRequest = async (
  req: Request,
  res: Response
) => {
  const userId = (req as any).user?._id;
  const { transactionId, reason } = req.body; // transactionId of the transaction to cancel, user's reason

  if (!userId || !transactionId || !reason) {
    return res
      .status(400)
      .json({ message: "Faltan datos requeridos: transactionId, reason." });
  }

  try {
    const request = await tokenService.createCancellationRequest({
      transactionId,
      userId: userId.toString(),
      reason,
    });
    // 201 Created indicates the request was successfully created.
    res.status(201).json({
      message: "Solicitud de cancelación enviada para revisión.",
      requestId: request._id,
      status: request.status,
    });
  } catch (error: any) {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en createCancellationRequest controller:", error);
    res
      .status(500)
      .json({ message: "Error al enviar solicitud de cancelación." });
  }
};

// --- ADMIN CONTROLLERS ---

/**
 * Admin function to adjust a user's token balance.
 * Creates a token transaction entry for auditing.
 */
export const adminAdjustUserTokens = async (req: Request, res: Response) => {
  const adminId = (req as any).user?._id; // Assuming admin ID is available from auth
  const { userId, amount, description } = req.body;

  if (!adminId) {
    return res
      .status(401)
      .json({ message: "No autenticado como administrador." });
  }
  if (!userId || typeof amount !== "number") {
    return res
      .status(400)
      .json({ message: "Faltan datos requeridos: userId, amount." });
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

/**
 * Admin function to update the status of a specific token transaction.
 * This should be used carefully as it doesn't automatically reverse funds.
 * Use `cancelTokens` for actual fund reversals with audit trails.
 */
export const adminUpdateTransactionStatus = async (
  req: Request,
  res: Response
) => {
  const adminId = (req as any).user?._id;
  const { transactionId } = req.params; // Transaction ID from URL param
  const { status, reason } = req.body;

  if (!adminId) {
    return res
      .status(401)
      .json({ message: "No autenticado como administrador." });
  }
  if (!status || !transactionId) {
    return res
      .status(400)
      .json({ message: "Faltan datos requeridos: transactionId, status." });
  }
  // Validate status to be one of the enum values, including new ones
  const validStatuses = [
    "completed",
    "failed",
    "cancelled",
    "pending_acceptance",
    "rejected",
  ];
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
    res
      .status(500)
      .json({ message: "Error al actualizar estado de transacción." });
  }
};

/**
 * Admin endpoint to get all pending cancellation requests from users.
 */
export const adminGetPendingCancellationRequests = async (
  req: Request,
  res: Response
) => {
  const adminId = (req as any).user?._id; // For admin check

  if (!adminId) {
    return res
      .status(401)
      .json({ message: "No autenticado como administrador." });
  }

  try {
    const requests = await tokenService.getPendingCancellationRequests();
    res.status(200).json(requests);
  } catch (error: any) {
    console.error(
      "Error en adminGetPendingCancellationRequests controller:",
      error
    );
    res.status(500).json({
      message: "Error al obtener solicitudes de cancelación pendientes.",
    });
  }
};

/**
 * Admin endpoint to review (approve or reject) a user's cancellation request.
 */
export const adminReviewCancellationRequest = async (
  req: Request,
  res: Response
) => {
  const adminId = (req as any).user?._id; // For admin check
  const { requestId } = req.params; // Cancellation request ID from URL param
  const { action, reviewReason } = req.body; // action: 'approve' or 'reject'

  if (!adminId) {
    return res
      .status(401)
      .json({ message: "No autenticado como administrador." });
  }
  if (!requestId || !action) {
    return res
      .status(400)
      .json({ message: "Faltan datos requeridos: requestId, action." });
  }
  if (!["approve", "reject"].includes(action)) {
    // Validate action type
    return res
      .status(400)
      .json({ message: "Acción inválida. Debe ser 'approve' o 'reject'." });
  }

  try {
    const updatedRequest = await tokenService.reviewCancellationRequest({
      requestId,
      adminId: adminId.toString(),
      action,
      reviewReason,
    });
    res.status(200).json({
      message: `Solicitud de cancelación ${
        action === "approve" ? "aprobada" : "rechazada"
      }.`,
      request: updatedRequest,
    });
  } catch (error: any) {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en adminReviewCancellationRequest controller:", error);
    res
      .status(500)
      .json({ message: "Error al revisar solicitud de cancelación." });
  }
};

// Get all transactions for admin view
export const adminGetAllTransactions = async (req: Request, res: Response) => {
  const adminId = (req as any).user?._id; // For admin check

  if (!adminId) {
    return res
      .status(401)
      .json({ message: "No autenticado como administrador." });
  }

  try {
    const transactions = await TokenTransaction.find({})
      .populate("senderId", "name email")
      .populate("receiverId", "name email")
      .sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error: any) {
    console.error("Error en adminGetAllTransactions controller:", error);
    res
      .status(500)
      .json({ message: "Error al obtener todas las transacciones." });
  }
};

/**
 * Admin: Get detailed info of a specific transaction by ID.
 */
export const adminGetTransactionById = async (req: Request, res: Response) => {
  const adminId = (req as any).user?._id;
  const { transactionId } = req.params;

  if (!adminId) {
    return res
      .status(401)
      .json({ message: "No autenticado como administrador." });
  }

  if (!transactionId) {
    return res.status(400).json({ message: "Falta el ID de la transacción." });
  }

  try {
    const transaction = await tokenService.getTransactionById(transactionId);
    res.status(200).json(transaction);
  } catch (error: any) {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en adminGetTransactionById controller:", error);
    res.status(500).json({ message: "Error al obtener la transacción." });
  }
};

/**
 * Admin: Get all transactions involving a specific user.
 */
export const adminGetUserTransactions = async (req: Request, res: Response) => {
  const adminId = (req as any).user?._id;
  const { userId } = req.params;

  if (!adminId) {
    return res
      .status(401)
      .json({ message: "No autenticado como administrador." });
  }

  if (!userId) {
    return res.status(400).json({ message: "Falta el ID del usuario." });
  }

  try {
    const transactions = await tokenService.getUserTransactionsByAdmin(userId);
    res.status(200).json(transactions);
  } catch (error: any) {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en adminGetUserTransactions controller:", error);
    res
      .status(500)
      .json({ message: "Error al obtener transacciones del usuario." });
  }
};

/**
 * Admin: Get the current token balance of a specific user.
 */
export const adminGetUserBalance = async (req: Request, res: Response) => {
  const adminId = (req as any).user?._id;
  const { userId } = req.params;

  if (!adminId) {
    return res
      .status(401)
      .json({ message: "No autenticado como administrador." });
  }

  if (!userId) {
    return res.status(400).json({ message: "Falta el ID del usuario." });
  }

  try {
    const user = await tokenService.getUserBalanceByAdmin(userId);
    res.status(200).json({
      userId: user._id,
      name: user.name,
      email: user.email,
      balance: user.tokens,
    });
  } catch (error: any) {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error en adminGetUserBalance controller:", error);
    res
      .status(500)
      .json({ message: "Error al obtener el balance del usuario." });
  }
};
