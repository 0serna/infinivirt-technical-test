import { IsRfcUuid } from './is-rfc-uuid';

export class IdParamDto {
  @IsRfcUuid()
  id!: string;
}
