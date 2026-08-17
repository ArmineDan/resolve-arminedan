import { Body, Controller, Post } from "@nestjs/common";
import { ReplyGuardService } from "./reply-guard.service";
import { CheckReplyDto, CheckReplyResponse } from "./dto/check-reply.dto";

@Controller("replies")
export class ReplyGuardController {
  constructor(private readonly replyGuardService: ReplyGuardService) {}

  @Post("check")
  async check(@Body() dto: CheckReplyDto): Promise<CheckReplyResponse> {
    return this.replyGuardService.checkReply(dto);
  }
}
