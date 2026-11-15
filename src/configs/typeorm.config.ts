import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";

/**
 * Builds the TypeORM options from environment variables (see .env.example).
 * Credentials must never be hard-coded here, because this file is committed to Git.
 */
export const typeORMConfigFactory = (configService: ConfigService): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: Number(configService.get<string>('DB_PORT', '5432')),
    username: configService.getOrThrow<string>('DB_USERNAME'),
    password: configService.getOrThrow<string>('DB_PASSWORD'),
    database: configService.getOrThrow<string>('DB_DATABASE'),
    entities: [__dirname + '/../**/*.entity.{js,ts}'],
    logging: configService.get<string>('DB_LOGGING', 'false') === 'true' ? 'all' : false,
    // Auto-sync the schema in local development only. Never enable this in production.
    synchronize: configService.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
});
