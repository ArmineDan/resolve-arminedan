import { Module } from "@nestjs/common";
import { ReplyGuardController } from "./reply-guard.controller";
import { ReplyGuardService } from "./reply-guard.service";

@Module({
  controllers: [ReplyGuardController],
  providers: [ReplyGuardService],
  exports: [ReplyGuardService],
})
export class ReplyGuardModule {}
