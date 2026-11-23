import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { buildDatabaseOptions } from './database.options';

/**
 * The app's TypeORM options (used by TypeOrmModule in app.module.ts).
 *
 * The options themselves are built in database.options.ts, shared with the
 * TypeORM CLI (data-source.ts). Here they only read their settings through
 * ConfigService, which has loaded `.env` by the time this runs.
 */
export const typeORMConfigFactory = (
  configService: ConfigService,
): TypeOrmModuleOptions =>
  buildDatabaseOptions((name) => configService.get<string>(name));
