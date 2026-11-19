import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { ESLint } from "eslint";

const cwd = fileURLToPath(new URL("..", import.meta.url));

async function lint(source, overrideConfig) {
  const eslint = new ESLint({ cwd, overrideConfig });
  const [result] = await eslint.lintText(source, {
    filePath: "app/lint-config-fixture.tsx",
  });
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
  return result.messages;
}

const cases = [
  ["missing image descriptions", 'export function Example() { return <img src="/example.png" />; }', "jsx-a11y-x/alt-text"],
  ["invalid ARIA roles", 'export function Example() { return <div role="not-a-role" />; }', "jsx-a11y-x/aria-role"],
  ["missing React list keys", 'export function Example() { return <ul>{[1, 2].map(value => <li>{value}</li>)}</ul>; }', "@eslint-react/no-missing-key"],
  ["conditional hooks", 'import { useState } from "react"; export function Example({ enabled }: { enabled: boolean }) { if (enabled) useState(0); return <div />; }', "react-hooks/rules-of-hooks"],
  ["unused TypeScript variables", 'export function Example() { const unused = 1; return <div />; }', "@typescript-eslint/no-unused-vars"],
  ["blocking scripts", 'export function Example() { return <script src="/example.js" />; }', "@next/next/no-sync-scripts"],
  ["HTML injection outside the fixed theme bootstrap", 'export function Example({ html }: { html: string }) { return <div dangerouslySetInnerHTML={{ __html: html }} />; }', "@eslint-react/dom-no-dangerously-set-innerhtml"],
];

for (const [name, source, ruleId] of cases) {
  test(`Studio lint still reports ${name}`, async () => {
    const messages = await lint(source);
    assert.ok(messages.some(message => message.ruleId === ruleId), JSON.stringify(messages));
  });
}

test("Studio lint accepts valid typed JSX and correctly used hooks", async () => {
  const source = 'import { useState } from "react"; export function Example() { const [count, setCount] = useState(0); return <button type="button" onClick={() => setCount(count + 1)}>Count: {count}</button>; }';
  assert.deepEqual(await lint(source), []);
});

test("accessibility label matching keeps custom component globs working", async () => {
  const overrideConfig = {
    rules: {
      "jsx-a11y-x/label-has-associated-control": ["error", {
        labelComponents: ["Form*"],
        controlComponents: ["Field*"],
      }],
    },
  };
  const valid = 'export function Example() { return <FormLabel>Name<FieldInput /></FormLabel>; }';
  const invalid = 'export function Example() { return <FormLabel>Name</FormLabel>; }';
  const ruleId = "jsx-a11y-x/label-has-associated-control";
  assert.ok(!(await lint(valid, overrideConfig)).some(message => message.ruleId === ruleId));
  assert.ok((await lint(invalid, overrideConfig)).some(message => message.ruleId === ruleId));
});
