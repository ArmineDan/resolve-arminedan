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
      console.error(`Refused: '${filePath}' is an immutable build artifact or auto-generated file.`);
      process.exit(2);
    }

    process.exit(0);
  } catch (err) {
    process.exit(0); // Fail open
  }
});