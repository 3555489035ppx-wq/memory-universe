import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const queryPath = resolve(projectRoot, 'scripts/demo-search-queries.json');
const sourceDirectory = resolve(projectRoot, '.cache/demo-source');
const creditsPath = resolve(projectRoot, 'public/demo/demo-asset-credits.json');
const apiEndpoint = 'https://commons.wikimedia.org/w/api.php';
const downloadDate = new Date().toISOString().slice(0, 10);
const userAgent = 'MEMENTO/1.0 (local portfolio demo asset curation)';

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function fetchWithRetry(url, init, attempts = 5) {
  let latestError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok || response.status < 500) return response;
      latestError = new Error(`HTTP ${String(response.status)} for ${url}`);
    } catch (error) {
      latestError = error;
    }
    if (attempt < attempts) await delay(attempt * 1200);
  }
  throw latestError ?? new Error(`Request failed for ${url}`);
}

function textOnly(value = '') {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function metadataValue(metadata, key) {
  return metadata?.[key]?.value ?? '';
}

function commonsPage(title) {
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
}

async function requestJson(parameters) {
  const url = new URL(apiEndpoint);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await fetchWithRetry(url, { headers: { 'Api-User-Agent': userAgent } });
  if (!response.ok) throw new Error(`Commons API ${String(response.status)} for ${url}`);
  return response.json();
}

async function candidatesFor(query) {
  const data = await requestJson({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '30',
    gsrsearch: `${query} incategory:"Images from Unsplash"`,
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '1600',
    origin: '*',
  });
  return Object.values(data.query?.pages ?? {})
    .map((page) => ({ page, image: page.imageinfo?.[0] }))
    .filter(({ image }) => image?.mime === 'image/jpeg')
    .filter(({ image }) => image.width >= 1200 && image.height >= 900)
    .filter(({ image }) => {
      const ratio = image.width / image.height;
      return ratio >= 0.58 && ratio <= 1.9;
    })
    .filter(({ image }) => metadataValue(image.extmetadata, 'LicenseShortName') === 'CC0');
}

function selectCandidate(candidates, usedTitles) {
  return candidates.find(({ page }) => !usedTitles.has(page.title));
}

async function download(url, path) {
  const response = await fetchWithRetry(url, { headers: { 'User-Agent': userAgent } });
  if (!response.ok) throw new Error(`Download ${String(response.status)} for ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(path, bytes);
  return bytes.byteLength;
}

const queries = JSON.parse(await readFile(queryPath, 'utf8'));
if (!Array.isArray(queries) || queries.length !== 60) {
  throw new Error('Expected exactly 60 controlled demo search queries.');
}

await mkdir(sourceDirectory, { recursive: true });
let records = [];
try {
  const existing = JSON.parse(await readFile(creditsPath, 'utf8'));
  if (Array.isArray(existing.assets)) records = existing.assets;
} catch {
  // A missing first-run checkpoint is expected.
}
const usedTitles = new Set(records.map((record) => `File:${record.title}`));

for (let index = records.length; index < queries.length; index += 1) {
  const query = queries[index];
  const candidates = await candidatesFor(query);
  const selected = selectCandidate(candidates, usedTitles);
  if (!selected) throw new Error(`No unused CC0 JPEG found for query: ${query}`);
  const { page, image } = selected;
  usedTitles.add(page.title);
  const number = String(index + 1).padStart(3, '0');
  const outputPath = resolve(sourceDirectory, `memory-${number}.jpg`);
  const byteLength = await download(image.thumburl ?? image.url, outputPath);
  const metadata = image.extmetadata;
  records.push({
    memoryId: `demo-memory-${number}`,
    localSource: `.cache/demo-source/memory-${number}.jpg`,
    query,
    title: page.title.replace(/^File:/, ''),
    pageUrl: commonsPage(page.title),
    author: textOnly(metadataValue(metadata, 'Artist')) || 'Wikimedia Commons contributor',
    credit: textOnly(metadataValue(metadata, 'Credit')),
    license: metadataValue(metadata, 'LicenseShortName'),
    licenseUrl: metadataValue(metadata, 'LicenseUrl') || 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceUrl: image.url,
    downloadedUrl: image.thumburl ?? image.url,
    downloadDate,
    originalWidth: image.width,
    originalHeight: image.height,
    downloadedWidth: image.thumbwidth ?? image.width,
    downloadedHeight: image.thumbheight ?? image.height,
    byteLength,
  });
  await writeFile(
    creditsPath,
    `${JSON.stringify({ schemaVersion: 1, source: 'Wikimedia Commons', assets: records }, null, 2)}\n`,
    'utf8',
  );
  console.log(`${number}/060 · ${page.title}`);
}

await writeFile(
  creditsPath,
  `${JSON.stringify({ schemaVersion: 1, source: 'Wikimedia Commons', assets: records }, null, 2)}\n`,
  'utf8',
);
console.log(`Recorded ${String(records.length)} CC0 assets at ${creditsPath}`);
