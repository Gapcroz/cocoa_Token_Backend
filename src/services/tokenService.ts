// src/services/tokenService.ts
import User, { IUser } from "../models/user";
import TokenTransaction, {
  ITokenTransaction,
} from "../models/tokenTransaction";
import CancellationRequest, {
  ICancellationRequest,
} from "../models/cancellationRequest";
import mongoose from "mongoose";
import {
  BadRequestError,
  NotFoundError,
  InsufficientFundsError,
  TransactionExistsError,
  ConflictError,
  CustomError,
} from "../utils/errors";

interface TransferTokensOptions {
  senderId: string;
  receiverIdentifier: string; // Could be email or userId
  amount: number;
  requestId?: string; // For idempotency of the *initial request*
}

interface AcceptTransferOptions {
  transactionId: string; // ID of the pending_acceptance transaction
  receiverId: string;
}

interface RejectTransferOptions {
  transactionId: string; // ID of the pending_acceptance transaction
  receiverId: string;
  reason?: string;
}

interface CancelTokensOptions {
  transactionId: string; // ID of the completed transaction to cancel
  adminId: string; // The admin initiating the cancellation
  reason: string;
}

interface AdminAdjustTokensOptions {
  userId: string;
  amount: number; // Positive to add, negative to subtract
  description: string;
  adminId: string;
}

interface AdminUpdateTransactionStatusOptions {
  transactionId: string;
  status:
    | "completed"
    | "failed"
    | "cancelled"
    | "pending_acceptance"
    | "rejected"; // Added new statuses
  adminId: string;
  reason?: string;
}
interface CreateCancellationRequestOptions {
  transactionId: string;
  userId: string; // The user making the request
  reason: string;
}

interface ReviewCancellationRequestOptions {
  requestId: string; // The ID of the cancellation request
  adminId: string;
  action: "approved" | "rejected";
  reviewReason?: string;
}
class TokenService {
  private readonly COOLDOWN_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Initiates a token transfer request. Funds are reserved from the sender.
   * The transaction status will be 'pending_acceptance'.
   *
   * @param {TransferTokensOptions} options - The transfer request options.
   * @returns {Promise<ITokenTransaction>} The created token transaction in 'pending_acceptance' state.
   * @throws {CustomError} Specific error types for better client feedback.
   */
  public async requestTransfer(
    options: TransferTokensOptions
  ): Promise<ITokenTransaction> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { senderId, receiverIdentifier, amount, requestId } = options;

      if (amount <= 0) {
        throw new BadRequestError(
          "El monto a transferir debe ser mayor a cero."
        );
      }

      if (requestId) {
        const existingTransaction = await TokenTransaction.findOne({
          requestId,
        }).session(session);
        if (existingTransaction) {
          // If transaction exists with this requestId, return or throw based on status
          await session.abortTransaction();
          if (existingTransaction.status === "pending_acceptance") {
            throw new TransactionExistsError(
              "Una solicitud de transferencia con este ID de solicitud ya está pendiente de aceptación."
            );
          } else if (existingTransaction.status === "completed") {
            throw new TransactionExistsError(
              "Esta transferencia ya fue completada."
            );
          } else {
            throw new TransactionExistsError(
              `Una transacción con este ID de solicitud ya existe con estado: ${existingTransaction.status}.`
            );
          }
        }
      }

      const sender = await User.findById(senderId).session(session);
      if (!sender) {
        throw new NotFoundError("Remitente no encontrado.");
      }

      let receiver: IUser | null = null;
      if (mongoose.Types.ObjectId.isValid(receiverIdentifier)) {
        receiver = await User.findById(receiverIdentifier).session(session);
      }
      if (!receiver) {
        receiver = await User.findOne({ email: receiverIdentifier }).session(
          session
        );
      }
      if (!receiver) {
        throw new NotFoundError("Destinatario no encontrado.");
      }
      if (sender._id === receiver._id || sender.email === receiver.email) {
        throw new BadRequestError("No puedes transferir tokens a ti mismo.");
      }

      if (sender.tokens < amount) {
        throw new InsufficientFundsError(
          "Tokens insuficientes para la solicitud de transferencia."
        );
      }

      // Check if sender's funds are currently under cooldown
      if (sender.lastCancelledTransferCooldownUntil) {
        if (new Date() < sender.lastCancelledTransferCooldownUntil) {
          throw new BadRequestError(
            "Los fondos del remitente están en período de enfriamiento debido a una cancelación reciente. Inténtelo más tarde."
          );
        }
      }

      // Create a pending_acceptance transaction log
      const transaction = new TokenTransaction({
        senderId: sender._id,
        receiverId: receiver._id,
        amount: amount,
        status: "pending_acceptance",
        transactionType: "transfer_request",
        description: `Solicitud de transferencia a ${
          receiver.email || receiver.name
        }`,
        requestId: requestId,
      });
      await transaction.save({ session });

      // Reserve funds by debiting sender immediately
      const senderUpdate = await User.findByIdAndUpdate(
        sender._id,
        { $inc: { tokens: -amount } },
        { new: true, session: session }
      );

      if (!senderUpdate) {
        throw new CustomError("Error al reservar tokens del remitente.", 500);
      }

      await session.commitTransaction();
      return transaction;
    } catch (error: any) {
      await session.abortTransaction();
      if (error instanceof CustomError) {
        throw error;
      }
      console.error(
        "Error durante la solicitud de transferencia de tokens (servicio):",
        error
      );
      throw new CustomError(
        "Falló la solicitud de transferencia de tokens debido a un error interno."
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Accepts a pending token transfer request. Funds are credited to the receiver.
   * The transaction status changes to 'completed'.
   *
   * @param {AcceptTransferOptions} options - The acceptance options.
   * @returns {Promise<ITokenTransaction>} The completed token transaction.
   * @throws {NotFoundError} If transaction or receiver not found.
   * @throws {BadRequestError} If transaction is not in 'pending_acceptance' state or receiver mismatch.
   */
  public async acceptTransfer(
    options: AcceptTransferOptions
  ): Promise<ITokenTransaction> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { transactionId, receiverId } = options;

      const transaction = await TokenTransaction.findById(
        transactionId
      ).session(session);
      if (!transaction) {
        throw new NotFoundError("Solicitud de transferencia no encontrada.");
      }

      if (transaction.status !== "pending_acceptance") {
        throw new BadRequestError(
          `La transacción no está pendiente de aceptación, estado actual: ${transaction.status}.`
        );
      }

      if (!transaction.receiverId.equals(receiverId)) {
        throw new BadRequestError(
          "No estás autorizado para aceptar esta transferencia (ID de receptor no coincide)."
        );
      }

      const receiver = await User.findById(receiverId).session(session);
      if (!receiver) {
        throw new NotFoundError("Receptor no encontrado.");
      }

      // Credit tokens to receiver
      const receiverUpdate = await User.findByIdAndUpdate(
        receiver._id,
        { $inc: { tokens: transaction.amount } },
        { new: true, session: session }
      );

      if (!receiverUpdate) {
        throw new CustomError("Error al acreditar tokens al destinatario.");
      }

      // Update original transaction status to completed
      transaction.status = "completed";
      transaction.transactionType = "transfer_acceptance"; // Change type to reflect acceptance
      transaction.description = `Transferencia aceptada de ${
        transaction.senderId
      } por ${receiver.email || receiver.name}`;
      await transaction.save({ session });

      await session.commitTransaction();
      return transaction;
    } catch (error: any) {
      await session.abortTransaction();
      if (error instanceof CustomError) {
        throw error;
      }
      console.error(
        "Error durante la aceptación de transferencia de tokens (servicio):",
        error
      );
      throw new CustomError(
        "Falló la aceptación de transferencia de tokens debido a un error interno."
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Rejects a pending token transfer request. Funds are returned to the sender.
   * The transaction status changes to 'rejected'.
   *
   * @param {RejectTransferOptions} options - The rejection options.
   * @returns {Promise<ITokenTransaction>} The updated token transaction.
   * @throws {NotFoundError} If transaction or receiver not found.
   * @throws {BadRequestError} If transaction is not in 'pending_acceptance' state or receiver mismatch.
   */
  public async rejectTransfer(
    options: RejectTransferOptions
  ): Promise<ITokenTransaction> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { transactionId, receiverId, reason } = options;

      const transaction = await TokenTransaction.findById(
        transactionId
      ).session(session);
      if (!transaction) {
        throw new NotFoundError("Solicitud de transferencia no encontrada.");
      }

      if (transaction.status !== "pending_acceptance") {
        throw new BadRequestError(
          `La transacción no está pendiente de aceptación, estado actual: ${transaction.status}.`
        );
      }

      if (!transaction.receiverId.equals(receiverId)) {
        throw new BadRequestError(
          "No estás autorizado para rechazar esta transferencia (ID de receptor no coincide)."
        );
      }

      const sender = await User.findById(transaction.senderId).session(session);
      if (!sender) {
        // This is a critical data inconsistency, log it!
        console.error(
          `CRITICAL: Sender ${transaction.senderId} not found for pending transaction ${transaction._id}`
        );
        throw new CustomError("Remitente de la transacción no encontrado.");
      }

      // Return funds to sender
      const senderUpdate = await User.findByIdAndUpdate(
        sender._id,
        { $inc: { tokens: transaction.amount } },
        { new: true, session: session }
      );

      if (!senderUpdate) {
        throw new CustomError(
          "Error al devolver tokens al remitente (rejección)."
        );
      }

      // Update original transaction status to rejected
      transaction.status = "rejected";
      transaction.transactionType = "transfer_rejection"; // Change type to reflect rejection
      transaction.description = `Transferencia rechazada por ${receiverId}. Motivo: ${
        reason || "No especificado"
      }. Fondos devueltos al remitente.`;
      await transaction.save({ session });

      await session.commitTransaction();
      return transaction;
    } catch (error: any) {
      await session.abortTransaction();
      if (error instanceof CustomError) {
        throw error;
      }
      console.error(
        "Error durante el rechazo de transferencia de tokens (servicio):",
        error
      );
      throw new CustomError(
        "Falló el rechazo de transferencia de tokens debido a un error interno."
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Cancels a previously completed token transfer. Funds are returned to the original sender.
   * A new reversal transaction is created, and the original transaction status is updated to 'cancelled'.
   * The original sender's funds will be under a cooldown period.
   *
   * @param {CancelTokensOptions} options - The cancellation options.
   * @returns {Promise<ITokenTransaction>} The new cancellation transaction.
   * @throws {NotFoundError} If original transaction not found.
   * @throws {BadRequestError} If transaction is not 'completed' or already cancelled.
   */
  public async cancelTokens(
    options: CancelTokensOptions
  ): Promise<ITokenTransaction> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { transactionId, adminId, reason } = options;

      const originalTransaction = await TokenTransaction.findById(
        transactionId
      ).session(session);
      if (!originalTransaction) {
        throw new NotFoundError("Transacción original no encontrada.");
      }

      if (originalTransaction.status === "cancelled") {
        throw new BadRequestError(
          "Esta transacción ya ha sido cancelada previamente."
        );
      }
      if (originalTransaction.status !== "completed") {
        throw new BadRequestError(
          `Solo se pueden cancelar transacciones en estado 'completed'. Estado actual: ${originalTransaction.status}.`
        );
      }
      if (
        originalTransaction.transactionType === "transfer_cancellation" ||
        originalTransaction.transactionType === "transfer_rejection"
      ) {
        throw new BadRequestError(
          "No se puede cancelar una transacción de reversión/cancelación."
        );
      }

      const senderOfOriginal = await User.findById(
        originalTransaction.senderId
      ).session(session);
      const receiverOfOriginal = await User.findById(
        originalTransaction.receiverId
      ).session(session);
      const adminUser = await User.findById(adminId).session(session); // For logging who cancelled

      if (!senderOfOriginal || !receiverOfOriginal || !adminUser) {
        throw new CustomError(
          "Error de datos: remitente, receptor o administrador no encontrados.",
          500
        );
      }

      const amountToRevert = originalTransaction.amount;

      // 1. Debit the receiver of the original transaction
      // This user might go negative if they spent the tokens already.
      const receiverUpdate = await User.findByIdAndUpdate(
        receiverOfOriginal._id,
        { $inc: { tokens: -amountToRevert } },
        { new: true, session: session }
      );

      if (!receiverUpdate) {
        throw new CustomError(
          "Error al debitar tokens del receptor original para la cancelación."
        );
      }

      // 2. Credit the sender of the original transaction
      const senderUpdate = await User.findByIdAndUpdate(
        senderOfOriginal._id,
        { $inc: { tokens: amountToRevert } },
        { new: true, session: session }
      );

      if (!senderUpdate) {
        throw new CustomError(
          "Error al acreditar tokens al remitente original para la cancelación."
        );
      }

      // 3. Create a new "cancellation" transaction for audit trail
      const newCancellationTransaction = new TokenTransaction({
        senderId: receiverOfOriginal._id, // The one who is being debited (original receiver)
        receiverId: senderOfOriginal._id, // The one who is being credited (original sender)
        amount: amountToRevert,
        status: "completed", // The cancellation itself is a completed action
        transactionType: "transfer_cancellation",
        description: `Cancelación de la transacción #${originalTransaction._id}. Motivo: ${reason}.`,
        originalTransactionId: originalTransaction._id, // Link to the original
      });
      await newCancellationTransaction.save({ session });

      // 4. Update the original transaction status to 'cancelled'
      originalTransaction.status = "cancelled";
      originalTransaction.cancellationDetails = {
        reason: reason,
        cancelledBy: new mongoose.Types.ObjectId(adminUser._id),
        cancelledAt: new Date(),
        cooldownUntil: new Date(Date.now() + this.COOLDOWN_PERIOD_MS),
      };
      await originalTransaction.save({ session });

      // 5. Update sender's user document with cooldown timestamp
      // This is to prevent the original sender from immediately using the reverted funds
      await User.findByIdAndUpdate(
        senderOfOriginal._id,
        {
          lastCancelledTransferCooldownUntil:
            originalTransaction.cancellationDetails.cooldownUntil,
        },
        { session: session }
      );

      await session.commitTransaction();
      return newCancellationTransaction;
    } catch (error: any) {
      await session.abortTransaction();
      if (error instanceof CustomError) {
        throw error;
      }
      console.error(
        "Error durante la cancelación de tokens (servicio):",
        error
      );
      throw new CustomError(
        "Fallo la cancelación de tokens debido a un error interno."
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Retrieves all token transactions for a given user (as sender or receiver).
   * @param {string} userId - The ID of the user.
   * @returns {Promise<ITokenTransaction[]>} A list of token transactions.
   */
  public async getUserTransactions(
    userId: string
  ): Promise<ITokenTransaction[]> {
    return await TokenTransaction.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .populate("senderId", "name email")
      .populate("receiverId", "name email")
      .sort({ createdAt: -1 });
  }

  /**
   * Admin function to adjust a user's token balance.
   * Creates a token transaction entry for auditing.
   * @param {AdminAdjustTokensOptions} options - Options for adjustment.
   * @returns {Promise<IUser>} The updated user document.
   * @throws {NotFoundError} If user not found.
   * @throws {BadRequestError} If amount is zero.
   * @throws {CustomError} For other internal errors.
   */
  public async adminAdjustTokens(
    options: AdminAdjustTokensOptions
  ): Promise<IUser> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { userId, amount, description, adminId } = options;

      if (amount === 0) {
        throw new BadRequestError("El monto de ajuste no puede ser cero.");
      }

      const userToAdjust = await User.findById(userId).session(session);
      if (!userToAdjust) {
        throw new NotFoundError("Usuario no encontrado.");
      }

      // Perform atomic update
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { tokens: amount } },
        { new: true, session: session }
      );

      if (!updatedUser) {
        throw new CustomError(
          "Fallo al actualizar el balance de tokens del usuario."
        );
      }

      // Create an admin_credit/debit transaction log
      const transaction = new TokenTransaction({
        amount: Math.abs(amount), // Always log positive amount
        status: "completed",
        description: `Ajuste por administrador (${
          description || "Sin descripción"
        }).`,
      });

      if (amount < 0) {
        // If tokens are being debited from user
        transaction.senderId = new mongoose.Types.ObjectId(userToAdjust._id); // User is the actual sender of tokens
        transaction.receiverId = new mongoose.Types.ObjectId(adminId); // Admin is the conceptual receiver (system)
        transaction.transactionType = "admin_debit";
        transaction.description = `Débito de tokens por administrador (${
          description || "Sin descripción"
        }).`;
      } else {
        // If tokens are being credited to user
        transaction.senderId = new mongoose.Types.ObjectId(adminId); // Admin is the conceptual sender (system)
        transaction.receiverId = new mongoose.Types.ObjectId(userToAdjust._id); // User is the actual receiver of tokens
        transaction.transactionType = "admin_credit";
        transaction.description = `Crédito de tokens por administrador (${
          description || "Sin descripción"
        }).`;
      }

      await transaction.save({ session });

      await session.commitTransaction();
      return updatedUser;
    } catch (error: any) {
      await session.abortTransaction();
      if (error instanceof CustomError) {
        throw error;
      }
      console.error(
        "Error durante ajuste de tokens por administrador (servicio):",
        error
      );
      throw new CustomError(
        "Fallo el ajuste de tokens por administrador debido a un error interno."
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Admin function to update the status of a specific token transaction.
   * This should be used carefully as it doesn't automatically reverse funds.
   * Use `cancelTokens` for actual fund reversals with audit trails.
   *
   * @param {AdminUpdateTransactionStatusOptions} options - Options for status update.
   * @returns {Promise<ITokenTransaction>} The updated transaction document.
   * @throws {NotFoundError} If transaction not found.
   * @throws {BadRequestError} If new status is invalid for current state.
   */
  public async adminUpdateTransactionStatus(
    options: AdminUpdateTransactionStatusOptions
  ): Promise<ITokenTransaction> {
    const { transactionId, status, adminId, reason } = options;

    const transaction = await TokenTransaction.findById(transactionId);
    if (!transaction) {
      throw new NotFoundError("Transacción no encontrada.");
    }

    // Comprehensive validation for status transitions
    const currentStatus = transaction.status;

    if (currentStatus === status) {
      throw new BadRequestError(
        "El estado de la transacción ya es el solicitado."
      );
    }

    // Prevent direct status changes that should be handled by specific business logic (e.g., cancellations)
    if (status === "cancelled") {
      throw new BadRequestError(
        "Utilice el método 'cancelTokens' para cancelar una transacción, no este endpoint."
      );
    }
    if (
      status === "completed" &&
      (currentStatus === "failed" || currentStatus === "rejected")
    ) {
      throw new BadRequestError(
        "No se puede marcar una transacción fallida o rechazada como 'completada' directamente. Realice un nuevo ajuste si es necesario."
      );
    }
    if (
      status === "pending_acceptance" &&
      (currentStatus === "completed" ||
        currentStatus === "failed" ||
        currentStatus === "cancelled" ||
        currentStatus === "rejected")
    ) {
      throw new BadRequestError(
        `No se puede mover una transacción de '${currentStatus}' a 'pending_acceptance'.`
      );
    }

    // Generally allow moving from pending/pending_acceptance to failed/rejected
    if (
      currentStatus === "pending_acceptance" &&
      status !== "rejected" &&
      status !== "failed" &&
      status !== "completed"
    ) {
      throw new BadRequestError(
        `Transición de estado de '${currentStatus}' a '${status}' no permitida.`
      );
    }

    transaction.status = status;
    transaction.description =
      (transaction.description || "") +
      ` (Estado actualizado a ${status} por Admin: ${adminId} - ${
        reason || "No reason specified"
      })`;

    await transaction.save();
    return transaction;
  }
  /**
   * Allows a user to submit a request to cancel a completed transaction.
   * Creates a CancellationRequest document for admin review.
   *
   * @param {CreateCancellationRequestOptions} options - The request details.
   * @returns {Promise<ICancellationRequest>} The created cancellation request.
   * @throws {NotFoundError} If transaction not found.
   * @throws {BadRequestError} If transaction is not completed or already has a pending request.
   */
  public async createCancellationRequest(
    options: CreateCancellationRequestOptions
  ): Promise<ICancellationRequest> {
    const { transactionId, userId, reason } = options;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const transaction = await TokenTransaction.findById(
        transactionId
      ).session(session);
      if (!transaction) {
        throw new NotFoundError("Transacción no encontrada.");
      }

      // Only allow cancellation requests for completed transfer transactions
      if (
        transaction.status !== "completed" ||
        (transaction.transactionType !== "transfer_acceptance" &&
          transaction.transactionType !== "transfer") // Allow cancellation of original direct transfers too if you still have them
      ) {
        throw new BadRequestError(
          `Solo se pueden solicitar cancelaciones para transferencias completadas. Estado actual: ${transaction.status}.`
        );
      }

      // Check if the user is either the sender or receiver of the transaction
      if (
        !transaction.senderId.equals(userId) &&
        !transaction.receiverId.equals(userId)
      ) {
        throw new BadRequestError(
          "No tienes permiso para solicitar la cancelación de esta transacción."
        );
      }

      // Check for existing pending request for this transaction
      const existingRequest = await CancellationRequest.findOne({
        transactionId: transaction._id,
        status: "pending",
      }).session(session);

      if (existingRequest) {
        throw new ConflictError(
          "Ya existe una solicitud de cancelación pendiente para esta transacción."
        );
      }

      const cancellationRequest = new CancellationRequest({
        transactionId: transaction._id,
        requestedBy: new mongoose.Types.ObjectId(userId),
        reason,
        status: "pending",
      });

      await cancellationRequest.save({ session });
      await session.commitTransaction();
      return cancellationRequest;
    } catch (error: any) {
      await session.abortTransaction();
      if (error instanceof CustomError) {
        throw error;
      }
      console.error(
        "Error durante la creación de la solicitud de cancelación:",
        error
      );
      throw new CustomError(
        "Falló la creación de la solicitud de cancelación debido a un error interno."
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Admin function to review and act on a user's cancellation request.
   * If approved, it calls the `cancelTokens` method.
   *
   * @param {ReviewCancellationRequestOptions} options - The review details.
   * @returns {Promise<ICancellationRequest>} The updated cancellation request.
   * @throws {NotFoundError} If request not found.
   * @throws {BadRequestError} If request is not pending.
   */
  public async reviewCancellationRequest(
    options: ReviewCancellationRequestOptions
  ): Promise<ICancellationRequest> {
    const { requestId, adminId, action, reviewReason } = options;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await CancellationRequest.findById(requestId).session(
        session
      );
      if (!request) {
        throw new NotFoundError("Solicitud de cancelación no encontrada.");
      }

      if (request.status !== "pending") {
        throw new BadRequestError(`La solicitud ya ha sido ${request.status}.`);
      }

      request.reviewedBy = new mongoose.Types.ObjectId(adminId);
      request.reviewReason = reviewReason || `Acción de admin: ${action}`;
      request.status = action;

      if (action === "approved") {
        // Use the existing cancelTokens method to perform the actual reversal
        // Ensure the adminId passed is the one who is reviewing/approving
        const cancelledTransaction = await this.cancelTokens({
          transactionId: request.transactionId.toString(),
          adminId: adminId,
          reason: `Aprobación de solicitud de cancelación #${
            request._id
          }. Motivo del usuario: ${request.reason}. Motivo del admin: ${
            reviewReason || "N/A"
          }`,
        });
        // We might want to link the original request to the cancellation transaction if needed for audit:
        // cancelledTransaction.cancellationDetails.requestId = request._id; // Add this field to TokenTransaction if needed
        // await cancelledTransaction.save({ session });
        console.log(
          `Transacción ${request.transactionId} cancelada por aprobación de solicitud ${request._id}`
        );
      } else if (action === "rejected") {
        // No token action needed for rejection, just update the request status
        console.log(
          `Solicitud de cancelación ${request._id} rechazada por admin ${adminId}`
        );
      }

      await request.save({ session });
      await session.commitTransaction();
      return request;
    } catch (error: any) {
      await session.abortTransaction();
      if (error instanceof CustomError) {
        throw error;
      }
      console.error(
        "Error durante la revisión de la solicitud de cancelación:",
        error
      );
      throw new CustomError(
        "Falló la revisión de la solicitud de cancelación debido a un error interno."
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Admin function to get all pending cancellation requests.
   * @returns {Promise<ICancellationRequest[]>} List of pending requests.
   */
  public async getPendingCancellationRequests(): Promise<
    ICancellationRequest[]
  > {
    return await CancellationRequest.find({ status: "pending" })
      .populate("transactionId") // Populate the transaction details
      .populate("requestedBy", "name email")
      .sort({ createdAt: 1 }); // Oldest first
  }

  /**
   * Obtiene todas las solicitudes de transferencia enviadas por un usuario y que están pendientes de aceptación.
   * @param {string} userId - ID del usuario que envió las solicitudes.
   */
  public async getPendingTransferRequestsSent(
    userId: string
  ): Promise<ITokenTransaction[]> {
    const user = await User.findById(userId);
    console.log(
      "Buscando transferencias enviadas pendientes por aceptar..."
    );
    console.log("Usuario remitente:", user?.name);
    const results = await TokenTransaction.find({
      senderId: userId,
      status: "pending_acceptance",
      transactionType: "transfer_request",
    })
      .populate("receiverId", "name email")
      .sort({ createdAt: -1 });
    console.log(
      `Se encontraron ${results.length} transferencias pendientes enviadas.`
    );
    return results;
  }

  /**
   * Obtiene todas las solicitudes de transferencia recibidas por un usuario y que están pendientes de aceptación.
   * @param {string} userId - ID del usuario que recibió las solicitudes.
   */
  public async getPendingTransferRequestsReceived(
    userId: string
  ): Promise<ITokenTransaction[]> {
    return await TokenTransaction.find({
      receiverId: userId,
      status: "pending_acceptance",
      transactionType: "transfer_request",
    })
      .populate("senderId", "name email")
      .sort({ createdAt: -1 });
  }

  /**
   * Obtiene todas las solicitudes de cancelación enviadas por un usuario, en cualquier estado.
   * @param {string} userId - ID del usuario que hizo la solicitud de cancelación.
   */
  public async getUserCancellationRequests(
    userId: string
  ): Promise<ICancellationRequest[]> {
    return await CancellationRequest.find({
      requestedBy: userId,
    })
      .populate("transactionId")
      .sort({ createdAt: -1 });
  }
}

export default new TokenService();
