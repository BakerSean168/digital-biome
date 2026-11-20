import assert from 'node:assert/strict';
import test from 'node:test';
import { extractReleaseNotes, validateReleaseFiles } from './release-contract.ts';

test('release contract accepts only release-please-shaped commits', () => {
  const changelog = '# Changelog\n\n## [0.7.0] - 2026-10-02\n\n### Added\n\n- Delivery contract.\n';

  const accepted = validateReleaseFiles({
    packageVersion: '0.7.0',
    manifestVersion: '0.7.0',
    changelog,
    subjects: ['Merge pull request #100', 'chore(main): release 0.7.0'],
  });
  assert.deepEqual(accepted.errors, []);
  assert.equal(accepted.releaseShaped, true);

  const normal = validateReleaseFiles({
    packageVersion: '0.7.0',
    manifestVersion: '0.7.0',
    changelog,
    subjects: ['feat(nav): add shortcut'],
  });
  assert.deepEqual(normal.errors, []);
  assert.equal(normal.releaseShaped, false);
});

test('release notes stop at the next changelog section', () => {
  const changelog =
    '# Changelog\n\n## [0.7.0] - 2026-10-02\n\n### Added\n\n- A\n\n## [0.6.1] - 2026-10-01\n\n- B\n';

  assert.equal(
    extractReleaseNotes(changelog, '0.7.0'),
    '## [0.7.0] - 2026-10-02\n\n### Added\n\n- A\n',
  );
});
