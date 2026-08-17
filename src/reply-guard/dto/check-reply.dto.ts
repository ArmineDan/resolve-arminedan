export class CheckReplyDto {
  ticketId: string;
  proposedReply: string;
  context?: string;
}

export interface CheckReplyResponse {
  allowed: boolean;
  action: "SEND" | "BLOCK";
  reason: string;
  flags: string[];
}
