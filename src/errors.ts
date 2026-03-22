export class DraculaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraculaError";
  }
}

export class DraculaNetworkError extends DraculaError {
  public readonly status: number;
  public readonly retryable: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DraculaNetworkError";
    this.status = status;
    this.retryable = status === 429 || status >= 500;
  }
}

export class DraculaNotFoundError extends DraculaError {
  public readonly resource: string;
  public readonly identifier: string;

  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`);
    this.name = "DraculaNotFoundError";
    this.resource = resource;
    this.identifier = identifier;
  }
}

export class DraculaUserError extends DraculaError {
  public readonly code: string | null;
  public readonly field: string[] | null;

  constructor(
    message: string,
    code: string | null = null,
    field: string[] | null = null
  ) {
    super(message);
    this.name = "DraculaUserError";
    this.code = code;
    this.field = field;
  }
}

export class DraculaValidationError extends DraculaError {
  constructor(message: string) {
    super(message);
    this.name = "DraculaValidationError";
  }
}
