/**
 * Tests only: reads the business rules' source (with the TypeScript parser) and finds every
 * action that changes data, so a test can fail when one has no permission check.
 *
 * A function "writes" when it runs SQL itself (`.run(` / `.exec(`) or calls another function that
 * writes without a check of its own. A function whose first statement is `allow(ctx, '…')` is
 * checked: what it calls is covered by that check.
 */
import ts from 'typescript';

/* eslint-disable @typescript-eslint/no-require-imports -- Node-only modules, loaded in tests */
const fs = require('node:fs') as {
  readFileSync(path: string, encoding: 'utf8'): string;
  readdirSync(path: string): string[];
  readdirSync(path: string, o: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
};
const path = require('node:path') as {
  resolve(...p: string[]): string;
  join(...p: string[]): string;
  relative(from: string, to: string): string;
  sep: string;
};
/* eslint-enable @typescript-eslint/no-require-imports */
declare const __dirname: string;

export type ScannedFunction = {
  file: string;
  name: string;
  exported: boolean;
  /** Its first parameter is the business-rules context (`ctx`). */
  takesCtx: boolean;
  /** The permission of its first-line `allow(ctx, '…')`, if any. */
  allowed: string | null;
  /** Runs SQL itself. */
  writesDirectly: boolean;
  /** Names of the functions it calls. */
  calls: Set<string>;
};

const SRC = path.resolve(__dirname, '../..');

function scanFile(rel: string): ScannedFunction[] {
  const text = fs.readFileSync(path.join(SRC, rel), 'utf8');
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
  const out: ScannedFunction[] = [];
  for (const st of sf.statements) {
    if (!ts.isFunctionDeclaration(st) || !st.name || !st.body) continue;
    const exported = !!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const first = st.parameters[0];
    const takesCtx = !!first && ts.isIdentifier(first.name) && first.name.text === 'ctx';
    let allowed: string | null = null;
    // `allow(ctx, '…');` or `const who = allow(ctx, '…');`
    const head = st.body.statements[0];
    const call =
      head && ts.isExpressionStatement(head)
        ? head.expression
        : head && ts.isVariableStatement(head)
          ? head.declarationList.declarations[0]?.initializer
          : undefined;
    if (
      call &&
      ts.isCallExpression(call) &&
      ts.isIdentifier(call.expression) &&
      call.expression.text === 'allow'
    ) {
      const arg = call.arguments[1];
      if (arg && ts.isStringLiteral(arg)) allowed = arg.text;
    }
    let writesDirectly = false;
    const calls = new Set<string>();
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const e = n.expression;
        if (ts.isIdentifier(e)) calls.add(e.text);
        // SQL on a database (`ctx.db.run`, `db.exec`, `copy.run`), not a RegExp's `.exec`.
        if (
          ts.isPropertyAccessExpression(e) &&
          ['run', 'exec'].includes(e.name.text) &&
          /(^|\.)(db|copy)$/.test(e.expression.getText(sf))
        )
          writesDirectly = true;
      }
      ts.forEachChild(n, visit);
    };
    visit(st.body);
    out.push({
      file: rel,
      name: st.name.text,
      exported,
      takesCtx,
      allowed,
      writesDirectly,
      calls,
    });
  }
  return out;
}

/** The files whose actions must be checked: every business rule, and the backup actions. */
export function ruleFiles(): string[] {
  const domain = fs
    .readdirSync(path.join(SRC, 'domain'))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => `domain/${f}`);
  return [...domain, 'backup/store.ts', 'backup/engine.ts'];
}

/** Every function of those files, with whether it writes without a check (followed through calls). */
export function scanActions() {
  const all = ruleFiles().flatMap(scanFile);
  const byName = new Map<string, ScannedFunction>();
  for (const f of all) byName.set(f.name, f);
  const memo = new Map<string, boolean>();
  const uncheckedWriter = (f: ScannedFunction, seen = new Set<string>()): boolean => {
    if (f.allowed) return false;
    const known = memo.get(f.name);
    if (known !== undefined) return known;
    if (seen.has(f.name)) return false;
    seen.add(f.name);
    const result =
      f.writesDirectly ||
      [...f.calls].some((c) => {
        const g = byName.get(c);
        return !!g && uncheckedWriter(g, seen);
      });
    memo.set(f.name, result);
    return result;
  };
  return all.map((f) => ({ ...f, uncheckedWriter: uncheckedWriter(f) }));
}
