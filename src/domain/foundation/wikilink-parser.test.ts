import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseWikilinks, parseNoteWikilinks } from './wikilink-parser';

function fields(link: ReturnType<typeof parseWikilinks>[number]) {
  const { startIndex, length, ...rest } = link;
  return rest;
}

describe('parseWikilinks', () => {
  test('parses a plain link', () => {
    assert.deepEqual(fields(parseWikilinks('[[Target]]')[0]), {
      rawTarget: 'Target',
      target: 'Target',
      display: undefined,
      heading: undefined,
      blockRef: undefined,
      isImage: false,
    });
  });

  test('splits display text on the first pipe and trims it', () => {
    const [link] = parseWikilinks('[[Target| Display ]]');
    assert.equal(link.target, 'Target');
    assert.equal(link.display, 'Display');
  });

  test('keeps extra pipes inside the display text', () => {
    const [link] = parseWikilinks('[[A|B|C]]');
    assert.equal(link.target, 'A');
    assert.equal(link.display, 'B|C');
  });

  test('handles escaped pipes used in Obsidian tables', () => {
    const [link] = parseWikilinks('[[Target\\|Display]]');
    assert.equal(link.rawTarget, 'Target');
    assert.equal(link.display, 'Display');
  });

  test('extracts heading anchors', () => {
    const [link] = parseWikilinks('[[Target#Heading]]');
    assert.equal(link.target, 'Target');
    assert.equal(link.heading, 'Heading');
    assert.equal(link.blockRef, undefined);
  });

  test('extracts block references', () => {
    const [link] = parseWikilinks('[[Target^block-1]]');
    assert.equal(link.target, 'Target');
    assert.equal(link.blockRef, 'block-1');
    assert.equal(link.heading, undefined);
  });

  test('extracts a heading plus block reference', () => {
    const [link] = parseWikilinks('[[Target#Heading^block-1]]');
    assert.equal(link.target, 'Target');
    assert.equal(link.heading, 'Heading');
    assert.equal(link.blockRef, 'block-1');
  });

  test('flags image embeds with a bang', () => {
    const [link] = parseWikilinks('![[image.png]]');
    assert.equal(link.isImage, true);
    assert.equal(link.startIndex, 0);
    assert.equal(link.length, 14);
  });

  test('flags image links by extension even without a bang', () => {
    const [link] = parseWikilinks('[[photo.webp]]');
    assert.equal(link.isImage, true);
  });

  test('reports correct positions for multiple links in text', () => {
    const links = parseWikilinks('see [[A]] and [[B]]');
    assert.deepEqual(links.map(l => [l.startIndex, l.length, l.target]), [
      [4, 5, 'A'],
      [14, 5, 'B'],
    ]);
  });

  test('ignores unclosed brackets', () => {
    assert.deepEqual(parseWikilinks('[[broken'), []);
    assert.deepEqual(parseWikilinks('plain text'), []);
  });

  test('trims whitespace around targets', () => {
    const [link] = parseWikilinks('[[ Some Note ]]');
    assert.equal(link.rawTarget, 'Some Note');
    assert.equal(link.target, 'Some Note');
  });
});

describe('parseNoteWikilinks', () => {
  test('excludes image embeds', () => {
    const links = parseNoteWikilinks('![[img.png]] and [[note]]');
    assert.deepEqual(links.map(l => l.target), ['note']);
  });

  test('excludes image links by extension', () => {
    assert.deepEqual(parseNoteWikilinks('[[diagram.png]]'), []);
  });
});
