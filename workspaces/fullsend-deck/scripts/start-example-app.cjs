const { spawn } = require('node:child_process');
const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..');

verifyNativeSqlite();

const yarnPath = path.join(
  workspaceRoot,
  '.yarn',
  'releases',
  'yarn-4.17.1.cjs',
);
const child = spawn(
  process.execPath,
  [
    yarnPath,
    'workspaces',
    'foreach',
    '--all',
    '--parallel',
    '--interlaced',
    '--jobs',
    '2',
    '--include',
    'app',
    '--include',
    'backend',
    'run',
    'start',
    ...process.argv.slice(2),
  ],
  { cwd: workspaceRoot, stdio: 'inherit' },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on('error', error => {
  console.error(`Unable to launch the example app: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

function verifyNativeSqlite() {
  let database;
  try {
    const Database = require('better-sqlite3');
    database = new Database(':memory:');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
      `Cannot start Fullsend Deck with Node ${process.version} (native ABI ${process.versions.modules}).`,
    );
    console.error(detail);
    console.error(
      'Use the Node major selected when dependencies were installed, or run `yarn rebuild better-sqlite3` after switching Node versions.',
    );
    process.exit(1);
  } finally {
    database?.close();
  }
}
