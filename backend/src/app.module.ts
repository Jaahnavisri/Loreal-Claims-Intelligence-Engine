import { Module } from '@nestjs/common';
import { ClaimsModule } from './claims/claims.module';
import { SqliteModule } from './sqlite/sqlite.module';

@Module({ imports: [SqliteModule, ClaimsModule] })
export class AppModule {}

