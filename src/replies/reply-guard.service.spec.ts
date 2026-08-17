import { Test, TestingModule } from "@nestjs/testing";
import { ReplyGuardService } from "./reply-guard.service";

describe("ReplyGuardService", () => {
  let service: ReplyGuardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReplyGuardService],
    }).compile();

    service = module.get<ReplyGuardService>(ReplyGuardService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should flag unauthorized commitments and escalate or revise", async () => {
    jest.spyOn(service["anthropic"].messages, "create").mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            verdict: "REVISE",
            findings: [
              {
                severity: "HIGH",
                issue: "Unauthorized refund commitment",
                quote: "I will refund your $500",
              },
            ],
            confidence: 0.98,
            reasoning: "Support promised a refund without prior authorization.",
            injectionSuspected: false,
            requiresHuman: true,
          }),
        },
      ],
    } as any);

    const result = await service.checkReply({
      ticketId: "ticket-101",
      draft: "I will refund your $500 right now.",
    });

    expect(result.verdict).toBe("REVISE");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe("HIGH");
    expect(result.findings[0].issue).toContain("refund");
    expect(result.requiresHuman).toBe(true);
  });

  it("should allow a clean support reply (SEND)", async () => {
    jest.spyOn(service["anthropic"].messages, "create").mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            verdict: "SEND",
            findings: [],
            confidence: 0.99,
            reasoning:
              "Safe, helpful response with no disclosures or commitments.",
            injectionSuspected: false,
            requiresHuman: true,
          }),
        },
      ],
    } as any);

    const result = await service.checkReply({
      ticketId: "ticket-102",
      draft: "You can reset your password directly from the account settings.",
    });

    expect(result.verdict).toBe("SEND");
    expect(result.findings).toHaveLength(0);
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("should degrade closed on Anthropic API error", async () => {
    jest
      .spyOn(service["anthropic"].messages, "create")
      .mockRejectedValueOnce(new Error("API rate limit"));

    const result = await service.checkReply({
      ticketId: "ticket-103",
      draft: "Clean reply text",
    });

    expect(result.verdict).toBe("REVISE");
    expect(result.confidence).toBe(0.0);
    expect(result.findings[0].issue).toContain("Guard fallback triggered");
  });
});
