import { ValidateBy } from 'class-validator';
import { isUuid } from '../require-uuid';

export function IsRfcUuid() {
  return ValidateBy({
    name: 'isRfcUuid',
    validator: {
      validate: (value: unknown) => typeof value === 'string' && isUuid(value),
    },
  });
}
