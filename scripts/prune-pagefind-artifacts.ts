import path from 'node:path';
import { assertPagefindRuntimeSurface, prunePagefindGeneratedUi } from './pagefind-runtime-surface';

const pagefindDirectory = path.resolve('dist/pagefind');
const result = prunePagefindGeneratedUi(pagefindDirectory);
assertPagefindRuntimeSurface(pagefindDirectory);
console.log(
  `Pagefind runtime surface pruned: ${result.removedFiles.length} unused generated UI files, `
  + `${(result.removedBytes / 1024).toFixed(1)} KiB removed.`,
);
