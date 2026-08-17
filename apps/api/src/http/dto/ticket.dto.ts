import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import {
  COMMENT_VISIBILITIES,
  type CommentVisibility,
  type CreateTicketBody,
  type CreateTicketCommentBody,
  type PatchTicketAssigneeBody,
  type PatchTicketFieldsBody,
  type PatchTicketStatusBody,
  PRIORITIES,
  type Priority,
  TICKET_STATUSES,
  type TicketStatus,
} from '@support-ticketing/shared';
import { IsRfcUuid } from './is-rfc-uuid';
import { Trim } from './trim';

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
  @IsIn(PRIORITIES)
  priority?: Priority;
}

export class CreateTicketCommentDto implements CreateTicketCommentBody {
  @Trim()
  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsIn(COMMENT_VISIBILITIES)
  visibility?: CommentVisibility;
}

export class PatchTicketStatusDto implements PatchTicketStatusBody {
  @IsIn(TICKET_STATUSES)
  status!: TicketStatus;
}

export class PatchTicketAssigneeDto implements PatchTicketAssigneeBody {
  @ValidateIf((_, value) => value !== null)
  @IsRfcUuid()
  assigneeId!: string | null;
}

export class PatchTicketFieldsDto implements PatchTicketFieldsBody {
  @ValidateIf((_, value) => value !== undefined)
  @Trim()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Trim()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(PRIORITIES)
  priority?: Priority;
}
