import { Module } from "@nestjs/common";
import { ReplyGuardController } from "./reply-guard.controller";
import { ReplyGuardService } from "./reply-guard.service";
import { TicketsModule } from "../tickets/tickets.module";

@Module({
  imports: [TicketsModule],
  controllers: [ReplyGuardController],
  providers: [ReplyGuardService],
  exports: [ReplyGuardService],
})
export class ReplyGuardModule {}
