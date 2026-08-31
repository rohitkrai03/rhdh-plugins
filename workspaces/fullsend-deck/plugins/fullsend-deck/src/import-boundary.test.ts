import fs from 'node:fs';
import path from 'node:path';

describe('NFS and design-system boundary', () => {
  it('has no direct MUI, PatternFly, legacy plugin, or core-components imports', () => {
    const sourceRoot = path.resolve(__dirname);
    const source = sourceFiles(sourceRoot)
      .filter(file => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))
      .map(file => fs.readFileSync(file, 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/from ['"]@mui\//);
    expect(source).not.toMatch(/from ['"]@material-ui\//);
    expect(source).not.toMatch(/from ['"]@patternfly\//);
    expect(source).not.toMatch(/from ['"]@backstage\/core-components/);
    expect(source).not.toMatch(/\bcreatePlugin\b|\bcreateRoutableExtension\b/);
  });

  it('uses Backstage UI tokens rather than fixed theme colors', () => {
    const css = fs.readFileSync(
      path.join(
        __dirname,
        'components',
        'FullsendDeckSurface',
        'styles.module.css',
      ),
      'utf8',
    );
    expect(css).toContain('var(--bui-');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const value = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(value);
    return /\.(ts|tsx)$/.test(entry.name) ? [value] : [];
  });
}
