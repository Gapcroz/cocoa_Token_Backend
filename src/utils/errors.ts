// src/utils/errors.ts

export class CustomError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}

export class BadRequestError extends CustomError {
  constructor(message: string = "Bad Request") {
    super(message, 400);
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string = "Not Found") {
    super(message, 404);
  }
}

export class ConflictError extends CustomError {
  constructor(message: string = "Conflict") {
    super(message, 409);
  }
}

export class InsufficientFundsError extends BadRequestError {
  constructor(message: string = "Fondos insuficientes.") {
    super(message);
  }
}

export class TransactionExistsError extends ConflictError {
  constructor(message: string = "Esta transacción ya ha sido procesada.") {
    super(message);
  }
}

