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

  it("should block response with sensitive token leak", async () => {
    // Мокаем ответ SDK
    jest.spyOn(service["anthropic"].messages, "create").mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            allowed: false,
            action: "BLOCK",
            reason: "Contains sensitive system access key.",
            flags: ["NO_SENSITIVE_LEAKS"],
          }),
        },
      ],
    } as any);

    const result = await service.checkReply({
      ticketId: "ticket-101",
      proposedReply: "Here is your token: sk-ant-secret-12345",
    });

    expect(result.allowed).toBe(false);
    expect(result.action).toBe("BLOCK");
    expect(result.flags).toContain("NO_SENSITIVE_LEAKS");
  });

  it("should allow clean support reply", async () => {
    jest.spyOn(service["anthropic"].messages, "create").mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            allowed: true,
            action: "SEND",
            reason: "Clean reply.",
            flags: [],
          }),
        },
      ],
    } as any);

    const result = await service.checkReply({
      ticketId: "ticket-102",
      proposedReply: "You can reset your password in the account settings.",
    });

    expect(result.allowed).toBe(true);
    expect(result.action).toBe("SEND");
    expect(result.flags).toHaveLength(0);
  });
});
