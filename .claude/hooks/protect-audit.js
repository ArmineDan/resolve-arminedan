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
  if (typeof filePath === "string" && filePath.includes("src/audit/")) {
    console.error("Refused: edits to src/audit/ are protected.");
    process.exit(2);
  }

  process.exit(0);
});
