import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import {
  COMMENT_VISIBILITIES,
  type CommentVisibility,
  type CreateTicketBody,
  type CreateTicketCommentBody,
  type PatchTicketAssigneeBody,
  type PatchTicketStatusBody,
  PRIORITIES,
  type Priority,
  TICKET_STATUSES,
  type TicketStatus,
} from '@support-ticketing/shared';
import { isUuid } from '../require-uuid';
import { IsRfcUuid } from './is-rfc-uuid';
import { Trim } from './trim';

@ValidatorConstraint({ name: 'isUuidOrNull', async: false })
class IsUuidOrNullConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value === null || (typeof value === 'string' && isUuid(value));
  }
}

export class CreateTicketDto implements CreateTicketBody {
  @IsRfcUuid()
  clientId!: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsIn([...PRIORITIES])
  priority?: Priority;
}

export class CreateTicketCommentDto implements CreateTicketCommentBody {
  @Trim()
  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsIn([...COMMENT_VISIBILITIES])
  visibility?: CommentVisibility;
}

export class PatchTicketStatusDto implements PatchTicketStatusBody {
  @IsIn([...TICKET_STATUSES])
  status!: TicketStatus;
}

export class PatchTicketAssigneeDto implements PatchTicketAssigneeBody {
  @Validate(IsUuidOrNullConstraint)
  assigneeId!: string | null;
}
