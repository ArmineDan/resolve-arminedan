let input = "";

process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const filePath = data.tool_input?.file_path || data.tool_input?.path || "";

    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, "/");

    // Check exact folder boundaries for dist/, package-lock.json, or generated files
    const isImmutable = /(?:^|\/)dist\b/.test(normalizedPath) ||
                        /(?:^|\/)package-lock\.json$/.test(normalizedPath) ||
                        /(?:^|\/)generated\//.test(normalizedPath) ||
                        /\.generated\.[jt]sx?$/.test(normalizedPath);

    if (isImmutable) {
      const reason = `Heads up: '${filePath}' is normally auto-generated and shouldn't be hand-edited. Confirm below if you're sure you want to change it anyway.`;

      // Return both top-level and nested structures for maximum CLI compatibility
      const response = {
        permissionDecision: "ask",
        permissionDecisionReason: reason,
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "ask",
          permissionDecisionReason: reason
        }
      };

      console.log(JSON.stringify(response));
      process.exit(0);
    }

    process.exit(0);
  } catch (err) {
    process.exit(0); // Fail open
  }
});