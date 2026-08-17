import {
  BadRequestException,
  Module,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { exposeUnsetFields: false },
        exceptionFactory: (errors: ValidationError[]) =>
          new BadRequestException(`Invalid ${errors[0]?.property ?? 'input'}`),
      }),
    },
  ],
})
export class HttpModule {}
