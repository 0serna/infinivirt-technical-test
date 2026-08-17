import { IsNotEmpty, IsString } from 'class-validator';
import type {
  CreateClientBody,
  UpdateClientBody,
} from '@support-ticketing/shared';
import { Trim } from './trim';

export class CreateClientDto implements CreateClientBody {
  @Trim()
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateClientDto
  extends CreateClientDto
  implements UpdateClientBody {}
