import fs from 'node:fs';
import path from 'node:path';
import type { NotesIndex } from '../src/types/knowledge-index';
import { VISIBILITY_PRIVATE } from '../src/domain/constants';
import { toRouteSlug } from '../src/domain/note-routing';

export interface FunctionRouteManifest {
  version: 1;
  include: string[];
  exclude: string[];
}

const API_ROUTE = '/api/*';
const MAX_FUNCTION_ROUTE_RULES = 100;

export function protectedKnowledgeRoutePatterns(index: NotesIndex): string[] {
  const publicRoutes = index.entries
    .filter(entry => !entry.isAsset && !entry.draft && !entry.private && entry.visibility !== VISIBILITY_PRIVATE)
    .map(entry => `/notes/${toRouteSlug(entry.id)}`);

  const protectedRoutes = index.entries
    .filter(entry => !entry.isAsset && (entry.private || entry.draft || entry.visibility === VISIBILITY_PRIVATE))
    .map(entry => `/notes/${toRouteSlug(entry.id)}`)
    .sort();

  for (const protectedRoute of protectedRoutes) {
    const conflictingPublicRoute = publicRoutes.find(route =>
      route !== protectedRoute && route.startsWith(protectedRoute),
    );
    if (conflictingPublicRoute) {
      throw new Error(
        `Protected route wildcard would shadow a public route: ${protectedRoute} -> ${conflictingPublicRoute}`,
      );
    }
  }

  return protectedRoutes.map(route => `${route}*`);
}

export function buildFunctionRouteManifest(index: NotesIndex): FunctionRouteManifest {
  const include = [API_ROUTE, ...protectedKnowledgeRoutePatterns(index)];
  if (include.length > MAX_FUNCTION_ROUTE_RULES) {
    throw new Error(
      `Function route manifest needs ${include.length} include rules; Pages supports at most ${MAX_FUNCTION_ROUTE_RULES} total rules.`,
    );
  }
  return { version: 1, include, exclude: [] };
}

export function writeFunctionRouteManifest(
  notesIndexPath = path.join(process.cwd(), 'src/data/indexes/notes-index.json'),
  distRoot = path.join(process.cwd(), 'dist'),
): FunctionRouteManifest {
  if (!fs.existsSync(notesIndexPath) || !fs.existsSync(distRoot)) {
    throw new Error('Function route manifest requires generated notes-index.json and dist/.');
  }
  const index = JSON.parse(fs.readFileSync(notesIndexPath, 'utf8')) as NotesIndex;
  const manifest = buildFunctionRouteManifest(index);
  fs.writeFileSync(path.join(distRoot, '_routes.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}
