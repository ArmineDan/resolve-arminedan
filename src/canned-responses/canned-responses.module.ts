import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CannedResponsesService } from './canned-responses.service';
import { CannedResponsesController } from './canned-responses.controller';
import { CannedResponse } from './canned-response.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CannedResponse])],
  controllers: [CannedResponsesController],
  providers: [CannedResponsesService],
  exports: [CannedResponsesService],
})
export class CannedResponsesModule {}
