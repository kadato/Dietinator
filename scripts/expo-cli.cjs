const path = require('path');

require('./polyfill-os.cjs');

const version = process.versions.node;
const [major, minor, patch] = version.split('.').map(Number);
const meetsExpo =
  major > 20 ||
  (major === 20 && minor > 19) ||
  (major === 20 && minor === 19 && patch >= 4);

if (!meetsExpo) {
  const fakeNodePkg =
    process.execPath.includes(`${path.sep}node_modules${path.sep}node${path.sep}`);

  console.error('');
  console.error(`Node ${version} is below Expo SDK 56 minimum (20.19.4).`);
  console.error(`Node executable: ${process.execPath}`);
  if (fakeNodePkg) {
    console.error('');
    console.error(
      'The npm package named "node" in your home folder is shadowing real Node.js.',
    );
    console.error('Remove it, then reopen the terminal:');
    console.error('  cd %USERPROFILE%');
    console.error('  npm uninstall node');
    console.error('  nvm use 22');
  } else {
    console.error('');
    console.error('Use a supported Node version, then retry:');
    console.error('  nvm use 22');
    console.error('  node -v          (must show v22.x or newer)');
  }
  console.error('  npm start');
  console.error('');
  process.exit(1);
}

require(path.join(__dirname, '..', 'node_modules', 'expo', 'bin', 'cli'));
