#!/usr/bin/env node

const fs = require('fs');

function getStdin() {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch (e) {
    return '';
  }
}

const rawInput = getStdin();
if (!rawInput) process.exit(0);

let data;
try {
  data = JSON.parse(rawInput);
} catch (e) {
  process.exit(0);
}

const testPattern = /(\.test\.[jt]sx?|\.spec\.[jt]sx?|__tests__|__mocks__|[\/\\]test[\/\\]|[\/\\]tests[\/\\])/i;

function block(message) {
  const response = {
    decision: 'block',
    reason: `[HOOK BLOCK] ${message}`
  };
  
  console.log(JSON.stringify(response));
  process.stderr.write(`[HOOK BLOCK] ${message}\n`);
  
  process.exit(1);
}

const testCountPattern = /\b(it|test)\s*\(/g;
const expectCountPattern = /\bexpect\s*\(/g;
const skipPattern = /\b(describe|it|test)\.(skip|todo)\s*\(|\bx(describe|it)\s*\(/g;

function countMatches(str, regex) {
  return (str.match(regex) || []).length;
}

// Captures the literal name of each `it(...)`/`test(...)` call, e.g.
// it('does X', ...) -> "does X". Dynamic names (template literals with
// interpolation) are captured as-is, so they still match as long as the
// template text itself is unchanged.
function extractTestNames(content) {
  const regex = /\b(?:it|test)\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  const names = [];
  let m;
  while ((m = regex.exec(content))) {
    names.push(m[2]);
  }
  return names;
}

function toCountMap(names) {
  const map = new Map();
  for (const n of names) map.set(n, (map.get(n) || 0) + 1);
  return map;
}

function findMissingOrReduced(oldContent, newContent) {
  const oldCounts = toCountMap(extractTestNames(oldContent));
  const newCounts = toCountMap(extractTestNames(newContent));
  const missing = [];
  for (const [name, oldCount] of oldCounts) {
    const newCount = newCounts.get(name) || 0;
    if (newCount < oldCount) missing.push(name);
  }
  return missing;
}

// Finds the index of the ')' that closes the '(' at openIdx, skipping over
// parens that appear inside string/template literals so nested test bodies
// (which routinely contain their own parens) don't throw off the count.
function findMatchingParen(str, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    const c = str[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < str.length && str[i] !== quote) {
        if (str[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Extracts { name, body } for every it(...)/test(...) call, where body is
// the whole call's source text (whitespace-normalized) so unrelated
// formatting changes don't trigger a false positive.
function extractTestBlocks(content) {
  const regex = /\b(?:it|test)\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  const blocks = [];
  let m;
  while ((m = regex.exec(content))) {
    const startIdx = m.index;
    const openParenIdx = content.indexOf('(', startIdx);
    const endIdx = findMatchingParen(content, openParenIdx);
    if (endIdx === -1) continue;
    blocks.push({
      name: m[2],
      body: content.slice(startIdx, endIdx + 1).replace(/\s+/g, ' ').trim(),
    });
  }
  return blocks;
}

// A test "survives" a change only if its name AND body both still exist
// afterward (as an unclaimed pair, so renames/duplicates are handled
// correctly). Anything left over on the old side was modified or removed.
function findModifiedTests(oldContent, newContent) {
  const groupByName = (blocks) => {
    const map = new Map();
    for (const b of blocks) {
      if (!map.has(b.name)) map.set(b.name, []);
      map.get(b.name).push(b.body);
    }
    return map;
  };
  const oldMap = groupByName(extractTestBlocks(oldContent));
  const newMap = groupByName(extractTestBlocks(newContent));
  const modified = [];
  for (const [name, oldBodies] of oldMap) {
    const remainingNewBodies = (newMap.get(name) || []).slice();
    for (const oldBody of oldBodies) {
      const idx = remainingNewBodies.indexOf(oldBody);
      if (idx === -1) {
        modified.push(name);
      } else {
        remainingNewBodies.splice(idx, 1);
      }
    }
  }
  return modified;
}

function main(data) {
  const toolName = data.tool_name || data.tool || '';
  const toolInput = data.tool_input || data.input || {};
  const filePath = toolInput.file_path || toolInput.path || toolInput.target_file || '';

  // --- Bash-based deletion/truncation ---
  if (toolName.toLowerCase().includes('bash')) {
    const command = toolInput.command || '';

    // Any recursive delete is risky regardless of whether the literal path
    // string matches a test pattern (e.g. `rm -rf src`, `rm -fr .`).
    if (/\brm\b[^\n]*-[a-z]*r/i.test(command)) {
      block(`Recursive delete is prohibited (may remove test files): "${command}"`);
    }

    if (/\bfind\b[^\n]*-delete\b/i.test(command)) {
      block(`"find ... -delete" is prohibited (may remove test files): "${command}"`);
    }

    if (/\bgit\s+clean\b[^\n]*-[a-z]*f/i.test(command)) {
      block(`"git clean -f" is prohibited (may remove untracked test files): "${command}"`);
    }

    if (testPattern.test(command)) {
      if (/\b(rm|mv|unlink|shred)\b/i.test(command)) {
        block(`Removing/moving test files via Bash is prohibited: "${command}"`);
      }
      if (/\bgit\s+rm\b/i.test(command)) {
        block(`"git rm" on a test file is prohibited: "${command}"`);
      }
      if (/>{1,2}\s*\S/.test(command)) {
        block(`Truncating/overwriting a test file via shell redirection is prohibited: "${command}"`);
      }
      if (/\b(sed|perl)\b[^\n]*-[a-z]*i/i.test(command)) {
        block(`In-place stream editing of a test file is prohibited (bypasses test-integrity checks): "${command}"`);
      }
    }
  }

  // --- Edit / Write on test files: compare before/after content ---
  if (filePath && testPattern.test(filePath)) {
    const existingContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null;

    let newContent = null;
    if (toolName.includes('Write')) {
      newContent = toolInput.content ?? toolInput.text ?? null;
    } else if (toolName.includes('Edit')) {
      // Поддержка всех вариантов имен ключей для Edit в Claude Code
      const oldString = toolInput.old_string ?? toolInput.old_str ?? toolInput.oldText ?? '';
      const newString = toolInput.new_string ?? toolInput.new_str ?? toolInput.newText ?? '';

      if (existingContent !== null && oldString) {
        if (!existingContent.includes(oldString)) {
          // Let the tool itself fail with its normal "not found" error.
          return;
        }
        newContent = toolInput.replace_all
          ? existingContent.split(oldString).join(newString)
          : existingContent.replace(oldString, newString);
      }
    }

    if (existingContent !== null && newContent !== null) {
      const oldTestCount = countMatches(existingContent, testCountPattern);
      const newTestCount = countMatches(newContent, testCountPattern);
      const oldExpectCount = countMatches(existingContent, expectCountPattern);
      const newExpectCount = countMatches(newContent, expectCountPattern);
      const oldSkipCount = countMatches(existingContent, skipPattern);
      const newSkipCount = countMatches(newContent, skipPattern);

      if (newTestCount < oldTestCount) {
        block(
          `Change to "${filePath}" reduces the number of test cases (from ${oldTestCount} to ${newTestCount}).`
        );
      }
      if (newExpectCount < oldExpectCount) {
        block(
          `Change to "${filePath}" reduces the number of assertions (from ${oldExpectCount} to ${newExpectCount}).`
        );
      }
      if (newSkipCount > oldSkipCount) {
        block(
          `Change to "${filePath}" adds a skipped/disabled test (.skip/.todo/xdescribe/xit).`
        );
      }

      const missingNames = findMissingOrReduced(existingContent, newContent);
      if (missingNames.length > 0) {
        block(
          `Change to "${filePath}" removes or renames existing test case(s): ${missingNames
            .map((n) => `"${n}"`)
            .join(', ')}.`
        );
      }

      // New tests are allowed; changing the body of one that already
      // exists is not, on the assumption that an existing, passing test
      // should not be quietly rewritten to make a bug disappear.
      const modifiedNames = findModifiedTests(existingContent, newContent);
      if (modifiedNames.length > 0) {
        block(
          `Change to "${filePath}" modifies the body of existing test case(s): ${modifiedNames
            .map((n) => `"${n}"`)
            .join(', ')}. Add a new test instead of editing an existing one.`
        );
      }
    }
  }
}

try {
  main(data);
  process.exit(0);
} catch (e) {
  // Fail open: a bug in this hook must never wedge or silently block an
  // unrelated tool call. `block()` calls process.exit(1) directly and never
  // throws, so any error caught here is an unexpected hook bug, not an
  // intentional block.
  console.error(`[HOOK ERROR] prevent-test-deletion.js: ${e && e.message}`);
  process.exit(0);
}