import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function createHost(): {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    filter = new AllExceptionsFilter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serializes HttpException as Nest error JSON', () => {
    const { host, status, json } = createHost();

    filter.catch(new BadRequestException('Invalid title'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Invalid title',
      error: 'Bad Request',
    });
  });

  it('maps Prisma unique conflict to 409', () => {
    const { host, status, json } = createHost();
    const unique = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: 'test' },
    );

    filter.catch(unique, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      message: 'Conflict',
      error: 'Conflict',
    });
  });

  it('maps unexpected Error to opaque 500 without internals', () => {
    const { host, status, json } = createHost();

    filter.catch(new Error('secret P2002 TicketsService'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toMatch(
      /secret|P2002|TicketsService/i,
    );
  });

  it('does not leak HttpException payload fields beyond the Nest error keys', () => {
    const { host, json } = createHost();
    const exception = new HttpException(
      {
        statusCode: 400,
        message: 'Invalid title',
        error: 'Bad Request',
        stack: 'nope',
      },
      400,
    );

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Invalid title',
      error: 'Bad Request',
    });
  });
});
