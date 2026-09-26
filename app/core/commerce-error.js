export class CommerceError extends Error {
  constructor(message, code = 'COMMERCE_ERROR', details = {}) {
    super(message);
    this.name = 'CommerceError';
    this.code = code;
    this.details = details;
  }
}
