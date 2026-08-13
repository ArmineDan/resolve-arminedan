const { execSync } = require("child_process");

let input = "";

process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const command = data.tool_input?.command || "";

    // 1. Block destructive rm -rf targeting root/home/system/parent dirs
    const isDangerousRm = /rm\s+-[a-zA-R]*r[a-zA-R]*f[a-zA-R]*\s+(['"]?\/['"]?|~|\$HOME|\.\.)(\/.*)?$/i.test(command) ||
                          /rm\s+-[a-zA-R]*f[a-zA-R]*r[a-zA-R]*\s+(['"]?\/['"]?|~|\$HOME|\.\.)(\/.*)?$/i.test(command);

    if (isDangerousRm) {
      console.error("Refused: Destructive system directory deletion is not allowed.");
      process.exit(2);
    }

    // 2. Block force pushes targeting main/master or running force-push without explicit safe branch
    if (/git\s+push\s+.*(--force|-f).*/.test(command)) {
      const targetsMain = /\b(main|master)\b/.test(command);

      let currentBranch = "";
      try {
        // Explicitly set cwd to current working directory
        currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
          encoding: "utf8",
          cwd: process.cwd()
        }).trim();
      } catch (e) {
        // If git branch check fails during force push, block as safety precaution
        console.error("Refused: Unable to verify current branch during force push.");
        process.exit(2);
      }

      const isPushingToMain = targetsMain || currentBranch === "main" || currentBranch === "master";

      if (isPushingToMain) {
        console.error("Refused: Force pushing to main/master branch is strictly forbidden.");
        process.exit(2);
      }
    }

    process.exit(0);
  } catch (err) {
    process.exit(0); // Fail open
  }
});