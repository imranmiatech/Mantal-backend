import {
  INestApplication,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const getDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return undefined;
  }

  try {
    const url = new URL(databaseUrl);

    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set(
        'connection_limit',
        process.env.DATABASE_CONNECTION_LIMIT ?? '3',
      );
    }

    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set(
        'pool_timeout',
        process.env.DATABASE_POOL_TIMEOUT ?? '30',
      );
    }

    return url.toString();
  } catch {
    return databaseUrl;
  }
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const databaseUrl = getDatabaseUrl();

    super(
      databaseUrl
        ? {
            datasources: {
              db: {
                url: databaseUrl,
              },
            },
          }
        : undefined,
    );
  }

  async onModuleInit() {
    await this.connectWithRetry();
    this.logger.log('Connected to the database');
  }

  async connectWithRetry(retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        if (!this.isConnectionPoolError(error) || attempt === retries) {
          throw error;
        }

        this.logger.warn(
          `Database connection pool busy. Retrying ${attempt}/${retries - 1}...`,
        );
        await this.delay(attempt * 1000);
      }
    }
  }

  async withReconnect<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P1017' || error.code === 'P2024')
      ) {
        await this.$disconnect().catch(() => undefined);
        await this.connectWithRetry();
        return operation();
      }

      throw error;
    }
  }

  enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', () => {
      void app.close();
    });
  }

  private isConnectionPoolError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientInitializationError &&
      error.errorCode === 'P2024'
    );
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
