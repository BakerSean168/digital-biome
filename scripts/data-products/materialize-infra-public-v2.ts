import fs from 'node:fs';
import path from 'node:path';
import { parseInfraPublicV2 } from '../../src/domain/infrastructure/infra-public-v2';

/** Existing domain owner and JSON shape; callers must first verify the Release bytes. */
export function materializeInfraPublicV2(raw: string, outputPath: string) {
  const projection = parseInfraPublicV2(raw);
  const output = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const stage = fs.mkdtempSync(path.join(path.dirname(output), '.infra-output-'));
  try {
    const temporary = path.join(stage, 'next.json');
    fs.writeFileSync(temporary, `${JSON.stringify(projection, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, output);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
  return projection;
}
