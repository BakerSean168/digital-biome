import fs from 'node:fs';
import path from 'node:path';
import { parseInfraPublicV2 } from '../../src/domain/infrastructure/infra-public-v2';

const artifactPath = path.resolve(
  process.argv[2] ?? '.pds-runtime/infra-public-v2/infra-public-v2.json',
);
const outputPath = path.resolve(
  process.env.INFRA_PUBLIC_V2_OUTPUT?.trim() || 'src/data/infrastructure/infra-public-v2.json',
);

const projection = parseInfraPublicV2(fs.readFileSync(artifactPath, 'utf8'));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');

console.log(
  `infra-public-v2 materialize=PASS revision=${projection.source.revision} resources=${projection.payload.summary.resourceCount} output=${outputPath}`,
);
