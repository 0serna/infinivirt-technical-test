import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { AdminUserRow, UserCatalogRow } from '@support-ticketing/shared';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { requireUser } from '../auth/require-user';
import { adminIncludeDeleted } from '../http/admin-include-deleted';
import { IdParamDto } from '../http/dto/id-param.dto';
import {
  CreateUserDto,
  ResetPasswordDto,
  UpdateUserDto,
} from '../http/dto/user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequireRole('supervisor')
  list(
    @Req() request: AuthenticatedRequest,
    @Query('includeDeleted') includeDeleted?: string,
  ): Promise<UserCatalogRow[] | AdminUserRow[]> {
    const user = requireUser(request);
    return this.usersService.listCatalog(
      adminIncludeDeleted(includeDeleted, user.role),
    );
  }

  @Post()
  @RequireRole('admin')
  create(@Body() body: CreateUserDto): Promise<AdminUserRow> {
    return this.usersService.create(body);
  }

  @Patch(':id/password')
  @RequireRole('admin')
  resetPassword(
    @Param() params: IdParamDto,
    @Body() body: ResetPasswordDto,
  ): Promise<AdminUserRow> {
    return this.usersService.resetPassword(params.id, body);
  }

  @Patch(':id')
  @RequireRole('admin')
  update(
    @Param() params: IdParamDto,
    @Body() body: UpdateUserDto,
  ): Promise<AdminUserRow> {
    return this.usersService.update(params.id, body);
  }

  @Delete(':id')
  @RequireRole('admin')
  softDelete(
    @Req() request: AuthenticatedRequest,
    @Param() params: IdParamDto,
  ): Promise<AdminUserRow> {
    const actor = requireUser(request);
    return this.usersService.softDelete(params.id, actor.id);
  }

  @Post(':id/restore')
  @RequireRole('admin')
  restore(@Param() params: IdParamDto): Promise<AdminUserRow> {
    return this.usersService.restore(params.id);
  }
}
