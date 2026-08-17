import {
  BadRequestException,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';

function firstLeaf(errors: ValidationError[]): ValidationError | undefined {
  const [error] = errors;
  if (!error) {
    return undefined;
  }
  if (error.children && error.children.length > 0) {
    return firstLeaf(error.children) ?? error;
  }
  return error;
}

export function invalidInputException(
  errors: ValidationError[],
): BadRequestException {
  const leaf = firstLeaf(errors);
  const property = leaf?.property ?? 'input';
  if (leaf?.constraints?.cannotChangeEmail) {
    return new BadRequestException('Email cannot be changed');
  }
  return new BadRequestException(`Invalid ${property}`);
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: { exposeUnsetFields: false },
    exceptionFactory: invalidInputException,
  });
}
