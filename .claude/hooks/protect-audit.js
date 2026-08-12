#!/usr/bin/env node

let input = "";
process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.exit(0); 
  }

  const filePath = payload?.tool_input?.file_path;

  if (typeof filePath === "string") {
    const normalizedPath = filePath.replace(/\\/g, "/");

    const isAuditDir = /(^|\/)src\/audit\//.test(normalizedPath);

    if (isAuditDir) {
      console.error(
        "Refused: files in src/audit/ are protected to preserve audit trail integrity."
      );
      process.exit(2);
    }
  }

  process.exit(0);
});