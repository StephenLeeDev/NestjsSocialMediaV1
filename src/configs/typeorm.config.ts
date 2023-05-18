import { TypeOrmModuleOptions } from "@nestjs/typeorm";

export const typeORMConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    host: 'localhost',
    port: 4000,
    username: 'postgres',
    password: '0000',
    database: 'instagram-app',
    entities: [__dirname + '/../**/*.entity.{js,ts}'],
    synchronize: true
}