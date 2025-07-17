import User, { IUser } from "../models/user";
import TokenTransaction, {
  ITokenTransaction,
} from "../models/tokenTransaction";
import mongoose from "mongoose";
import {
  BadRequestError,
  NotFoundError,
  InsufficientFundsError,
  TransactionExistsError,
  CustomError, // Import CustomError to catch it
} from "../utils/errors"; // Import new custom errors

interface TransferTokensOptions {
  senderId: string;
  receiverIdentifier: string; // Could be email or userId
  amount: number;
  requestId?: string; // <-- New optional parameter for idempotency
}

interface AdminAdjustTokensOptions {
  userId: string;
  amount: number; // Positive to add, negative to subtract
  description: string;
  adminId: string;
}

interface AdminUpdateTransactionStatusOptions {
  transactionId: string;
  status: "completed" | "failed" | "cancelled";
  adminId: string;
  reason?: string;
}

class TokenService {
  /**
   * Initiates a token transfer between two users.
   * Handles idempotency, user lookup, balance check, atomic updates, and transaction logging.
   *
   * @param {TransferTokensOptions} options - The transfer options.
   * @returns {Promise<ITokenTransaction>} The completed token transaction.
   * @throws {CustomError} Specific error types for better client feedback.
   */
  public async transferTokens(
    options: TransferTokensOptions,
  ): Promise<ITokenTransaction> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { senderId, receiverIdentifier, amount, requestId } = options;

      if (amount <= 0) {
        throw new BadRequestError("El monto a transferir debe ser mayor a cero.");
      }

      if (requestId) {
        const existingTransaction = await TokenTransaction.findOne({ requestId }).session(session);
        if (existingTransaction) {
          // If transaction exists and is completed, return it.
          // If it's pending/failed/cancelled, handle as needed (e.g., throw error or retry).
          if (existingTransaction.status === "completed") {
            await session.abortTransaction(); // No changes were made in this new session
            throw new TransactionExistsError("Esta transferencia ya fue completada.");
          } else {
            // For now, if a pending/failed/cancelled transaction exists with same requestId,
            // we'll treat it as a duplicate attempt that failed previously or is still pending.
            // You might want a more complex retry logic here.
            await session.abortTransaction();
            throw new TransactionExistsError(`Una transacción con este ID de solicitud ya existe con estado: ${existingTransaction.status}.`);
          }
        }
      }


      // 1. Find Sender
      const sender = await User.findById(senderId).session(session);
      if (!sender) {
        throw new NotFoundError("Remitente no encontrado.");
      }

      // 2. Find Receiver (by email or ID)
      let receiver: IUser | null = null;
      if (mongoose.Types.ObjectId.isValid(receiverIdentifier)) {
        receiver = await User.findById(receiverIdentifier).session(session);
      }
      if (!receiver) {
        receiver = await User.findOne({ email: receiverIdentifier }).session(
          session,
        );
      }

      if (!receiver) {
        throw new NotFoundError("Destinatario no encontrado.");
      }

      if (sender._id===receiver._id || sender.email===receiver.email) {
        throw new BadRequestError("No puedes transferir tokens a ti mismo.");
      }

      // 3. Check Sender's Balance
      if (sender.tokens < amount) {
        throw new InsufficientFundsError("Tokens insuficientes para la transferencia.");
      }

      // 4. Create Pending Transaction Log
      const transaction = new TokenTransaction({
        senderId: sender._id,
        receiverId: receiver._id,
        amount: amount,
        status: "pending",
        transactionType: "transfer",
        description: `Transferencia de tokens a ${receiver.email || receiver.name}`,
        requestId: requestId, // Save the requestId
      });
      await transaction.save({ session });

      // 5. Perform Atomic Token Updates
      const senderUpdate = await User.findByIdAndUpdate(
        sender._id,
        { $inc: { tokens: -amount } },
        { new: true, session: session },
      );

      const receiverUpdate = await User.findByIdAndUpdate(
        receiver._id,
        { $inc: { tokens: amount } },
        { new: true, session: session },
      );

      // Verify updates were successful
      if (!senderUpdate || senderUpdate.tokens < 0) {
        // This indicates a critical state or a logic error after balance check
        throw new CustomError(
          "Error al actualizar los tokens del remitente (balance negativo inesperado).",
        );
      }
      if (!receiverUpdate) {
        throw new CustomError("Error al actualizar los tokens del destinatario.");
      }

      // 6. Update Transaction Status to Completed
      transaction.status = "completed";
      await transaction.save({ session });

      await session.commitTransaction();
      return transaction;
    } catch (error: any) {
      await session.abortTransaction();
      // Re-throw specific errors for the controller
      if (error instanceof CustomError) {
        throw error;
      }
      console.error("Error durante la transferencia de tokens (servicio):", error);
      throw new CustomError("Fallo la transferencia de tokens debido a un error interno.");
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
    userId: string,
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
    options: AdminAdjustTokensOptions,
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
        { new: true, session: session },
      );

      if (!updatedUser) {
        throw new CustomError(
          "Fallo al actualizar el balance de tokens del usuario.",
        );
      }

      // Create an admin_credit/debit transaction log
      const transaction = new TokenTransaction({
        senderId: amount < 0 ? userToAdjust._id : new mongoose.Types.ObjectId(adminId), // If debit, user is sender. If credit, admin is conceptual sender.
        receiverId: amount > 0 ? userToAdjust._id : new mongoose.Types.ObjectId(adminId), // If credit, user is receiver. If debit, admin is conceptual receiver.
        amount: Math.abs(amount), // Always log positive amount
        status: "completed",
        transactionType: "admin_credit", // Or "admin_debit", or just "admin_adjustment"
        description: `Ajuste por administrador (${description || "Sin descripción"}).`,
      });

      // Special handling for sender/receiver for admin transactions for clarity
      if (amount < 0) { // If tokens are being debited from user
        transaction.senderId =new mongoose.Types.ObjectId(userToAdjust._id);
        transaction.receiverId = new mongoose.Types.ObjectId(adminId); // Conceptual receiver, could be a system account
        transaction.description = `Débito de tokens por administrador (${description || "Sin descripción"}).`;
      } else { // If tokens are being credited to user
        transaction.senderId = new mongoose.Types.ObjectId(adminId); // Conceptual sender, could be a system account
        transaction.receiverId = new mongoose.Types.ObjectId(userToAdjust._id);
        transaction.description = `Crédito de tokens por administrador (${description || "Sin descripción"}).`;
      }

      await transaction.save({ session });

      await session.commitTransaction();
      return updatedUser;
    } catch (error: any) {
      await session.abortTransaction();
      if (error instanceof CustomError) {
        throw error;
      }
      console.error("Error durante ajuste de tokens por administrador (servicio):", error);
      throw new CustomError(
        "Fallo el ajuste de tokens por administrador debido a un error interno.",
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Admin function to update the status of a specific token transaction.
   * This should only be used for correcting status, not reversing tokens unless explicitly handled.
   * @param {AdminUpdateTransactionStatusOptions} options - Options for status update.
   * @returns {Promise<ITokenTransaction>} The updated transaction document.
   * @throws {NotFoundError} If transaction not found.
   * @throws {BadRequestError} If new status is invalid for current state.
   */
  public async adminUpdateTransactionStatus(
    options: AdminUpdateTransactionStatusOptions,
  ): Promise<ITokenTransaction> {
    const { transactionId, status, adminId, reason } = options;

    const transaction = await TokenTransaction.findById(transactionId);
    if (!transaction) {
      throw new NotFoundError("Transacción no encontrada.");
    }

    // Prevent changing status of already completed transactions, or use specific logic
    if (transaction.status === "completed" && status !== "completed") {
        throw new BadRequestError("No se puede cambiar el estado de una transacción ya completada (considerar una nueva transacción de reversión).");
    }

    // More granular logic for state transitions (e.g., pending -> cancelled/failed is okay)
    if (transaction.status === "failed" && status === "completed") {
        throw new BadRequestError("No se puede marcar una transacción fallida como completada sin revertir manualmente el estado de los tokens.");
    }

    transaction.status = status;
    transaction.description = transaction.description + ` (Actualizado a ${status} por Admin: ${adminId} - ${reason || 'No reason specified'})`;

    await transaction.save();
    return transaction;
  }
}

export default new TokenService();