const fs = require("fs");

let input = "";

process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const toolInput = data.tool_input || {};
    const filePath = toolInput.file_path || toolInput.path || "";

    // 1. Check if the file is a test file (*.spec.* or *.test.*)
    const isTestFile = /\.spec\.[jt]sx?$|\.test\.[jt]sx?$/.test(filePath);
    if (!isTestFile) {
      process.exit(0); // Non-test file (even if it contains "it(") — allow
    }

    // Helper function to count test declarations: it( and test(
    const countTests = (str) => {
      if (!str) return 0;
      const matches = str.match(/(?:it|test)\s*\(/g);
      return matches ? matches.length : 0;
    };

    let oldCount = 0;
    let newCount = 0;

    // 2. Scenario A: Edit request (contains old_string and new_string)
    if (typeof toolInput.old_string === "string" && typeof toolInput.new_string === "string") {
      oldCount = countTests(toolInput.old_string);
      newCount = countTests(toolInput.new_string);
    } 
    // 3. Scenario B: Write request (fixing "The Gap")
    else if (typeof toolInput.content === "string") {
      newCount = countTests(toolInput.content);

      // If the file already exists on disk — read its current content
      if (fs.existsSync(filePath)) {
        const existingContent = fs.readFileSync(filePath, "utf8");
        oldCount = countTests(existingContent);
      } else {
        // Brand-new spec file — initial count = 0
        oldCount = 0;
      }
    }

    // 4. Verification: test count must never decrease
    if (newCount < oldCount) {
      console.error(
        `Refused: test count decreased from ${oldCount} to ${newCount}. Edits or writes to test files may add tests, but never remove them.`
      );
      process.exit(2); // Block
    }

    process.exit(0); // Allow
  } catch (err) {
    // Fail open on JSON parse errors or other exceptions
    process.exit(0);
  }
});