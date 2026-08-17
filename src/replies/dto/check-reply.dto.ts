export class CheckReplyDto {
  ticketId: string;
  draft: string;
}

export interface Finding {
  severity: "HIGH" | "MEDIUM";
  issue: string;
  quote: string;
}

export interface CheckReplyResponse {
  verdict: "SEND" | "REVISE" | "ESCALATE";
  findings: Finding[];
  confidence: number;
  reasoning: string;
  injectionSuspected: boolean;
  requiresHuman: boolean;
}
