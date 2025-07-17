import User, { IUser } from "../models/user";
import TokenTransaction, {
  ITokenTransaction,
} from "../models/tokenTransaction";
import mongoose from "mongoose";

interface TransferTokensOptions {
  senderId: string;
  receiverIdentifier: string; // Could be email or userId
  amount: number;
}

class TokenService {
  /**
   * Initiates a token transfer between two users.
   * Handles user lookup, balance check, atomic updates, and transaction logging.
   *
   * @param {TransferTokensOptions} options - The transfer options.
   * @returns {Promise<ITokenTransaction>} The completed token transaction.
   * @throws {Error} If sender/receiver not found, insufficient tokens, or database error.
   */
  public async transferTokens(
    options: TransferTokensOptions,
  ): Promise<ITokenTransaction> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { senderId, receiverIdentifier, amount } = options;

      if (amount <= 0) {
        throw new Error("El monto a transferir debe ser mayor a cero.");
      }

      // 1. Find Sender
      const sender = await User.findById(senderId).session(session);
      if (!sender) {
        throw new Error("Remitente no encontrado.");
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
        throw new Error("Destinatario no encontrado.");
      }

      if (sender._id === receiver._id) {
        throw new Error("No puedes transferir tokens a ti mismo.");
      }

      // 3. Check Sender's Balance
      if (sender.tokens < amount) {
        throw new Error("Tokens insuficientes para la transferencia.");
      }

      // 4. Create Pending Transaction Log
      const transaction = new TokenTransaction({
        senderId: sender._id,
        receiverId: receiver._id,
        amount: amount,
        status: "pending",
        transactionType: "transfer",
        description: `Transferencia de tokens a ${receiver.email || receiver.name}`,
      });
      await transaction.save({ session });

      // 5. Perform Atomic Token Updates (Critical for Race Conditions)
      // Using $inc for atomic increment/decrement
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

      // Verify updates were successful (e.g., sender's balance didn't go negative unexpectedly)
      if (!senderUpdate || senderUpdate.tokens < 0) {
        throw new Error(
          "Error al actualizar los tokens del remitente (balance negativo).",
        );
      }
      if (!receiverUpdate) {
        throw new Error("Error al actualizar los tokens del destinatario.");
      }

      // 6. Update Transaction Status to Completed
      transaction.status = "completed";
      await transaction.save({ session });

      await session.commitTransaction();
      return transaction;
    } catch (error: any) {
      await session.abortTransaction();
      console.error("Error durante la transferencia de tokens:", error.message);
      throw new Error(
        `Fallo la transferencia de tokens: ${error.message || "Error desconocido"}`,
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
    userId: string,
  ): Promise<ITokenTransaction[]> {
    return await TokenTransaction.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .populate("senderId", "name email") // Populate sender's name and email
      .populate("receiverId", "name email") // Populate receiver's name and email
      .sort({ createdAt: -1 }); // Sort by newest first
  }
}

export default new TokenService(); // Export an instance of the service