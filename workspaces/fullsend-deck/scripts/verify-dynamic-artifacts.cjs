const assert = require('node:assert/strict');
const { access, readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const root = resolve('dist-dynamic-packages');
  const frontendRoot = resolve(
    root,
    'frontend/red-hat-developer-hub-backstage-plugin-fullsend-deck',
  );
  const backendRoot = resolve(
    root,
    'backend/red-hat-developer-hub-backstage-plugin-fullsend-deck-backend',
  );
  const frontend = JSON.parse(
    await readFile(resolve(frontendRoot, 'package.json'), 'utf8'),
  );
  const backend = JSON.parse(
    await readFile(resolve(backendRoot, 'package.json'), 'utf8'),
  );
  const federation = JSON.parse(
    await readFile(resolve(frontendRoot, 'dist/mf-manifest.json'), 'utf8'),
  );

  assert.equal(frontend.backstage?.role, 'frontend-plugin');
  assert.equal(frontend.backstage?.pluginId, 'fullsend-deck');
  assert.equal(
    frontend.backstage?.features?.['.'],
    '@backstage/FrontendPlugin',
  );
  assert.equal(frontend.backstage?.['supported-versions'], '1.54.0');
  assert.equal(federation.exposes?.[0]?.name, '.');
  await access(resolve(frontendRoot, 'dist/remoteEntry.js'));
  await access(resolve(frontendRoot, 'dist/mf-manifest.json'));
  await access(resolve(frontendRoot, 'dist-scalprum')).then(
    () => {
      throw new Error('NFS frontend unexpectedly contains Scalprum assets');
    },
    () => undefined,
  );

  assert.equal(backend.backstage?.role, 'backend-plugin');
  assert.equal(backend.backstage?.pluginId, 'fullsend-deck');
  assert.equal(backend.backstage?.['supported-versions'], '1.54.0');
  assert.equal(backend.bundleDependencies, true);
  await access(
    resolve(
      backendRoot,
      'node_modules/@red-hat-developer-hub/backstage-plugin-fullsend-deck-common/dist/index.cjs.js',
    ),
  );
  const backendModule = await import(
    pathToFileURL(resolve(backendRoot, backend.main))
  );
  assert.equal(typeof backendModule.default, 'object');

  console.log(
    JSON.stringify({
      result: 'pass',
      backstage: frontend.backstage['supported-versions'],
      frontend: frontend.name,
      frontendFormat: 'NFS module federation',
      backend: backend.name,
      backendEntry: typeof backendModule.default,
      commonContract: 'embedded',
    }),
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
