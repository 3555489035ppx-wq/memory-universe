import { readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));
const projectDirectory = join(scriptDirectory, '..');
const musicDirectory = join(projectDirectory, 'public', 'music');
const outputFile = join(musicDirectory, 'music-library.json');
const sourceOutputFile = join(projectDirectory, 'src', 'features', 'music', 'data', 'music-library.json');
const audioExtensions = new Set(['.mp3', '.wav']);

const knownMetadata = new Map([
  ['te-bie-de-ren-fang-datong.mp3', {
    id: 'highschool_01',
    title: '特别的人', artist: '方大同', category: '高中回忆', duration: 259,
  }],
  ['memento-ambience.wav', {
    id: 'highschool_02',
    title: '那年夏天 · MEMENTO 氛围音', artist: 'Memuniverse Studio', category: '高中回忆', duration: 180,
  }],
  ['kai-yuan-ren-zhi-ge.mp3', {
    id: 'highschool_03',
    title: '开源人之歌 · 伴奏', artist: '林旅强 / 庄表伟', category: '高中回忆', duration: 217,
  }],
]);

async function collectAudioFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'music-library.json' || entry.name === '.gitkeep') continue;
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectAudioFiles(entryPath));
    else if (audioExtensions.has(extname(entry.name).toLowerCase())) files.push(entryPath);
  }
  return files;
}

function titleFromFileName(fileName) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || '待修改歌曲名称';
}

const files = (await collectAudioFiles(musicDirectory)).sort();
const records = files.map((filePath, index) => {
  const fileName = filePath.slice(filePath.lastIndexOf(sep) + 1);
  const relativePath = relative(projectDirectory, filePath).split(sep).join('/');
  const metadata = knownMetadata.get(fileName) ?? {
    title: titleFromFileName(fileName),
    artist: '待修改作者',
    category: '待修改分类',
  };
  return {
    id: metadata.id ?? (metadata.category === '高中回忆' ? `highschool_${String(index + 1).padStart(2, '0')}` : `music_${String(index + 1).padStart(2, '0')}`),
    ...metadata,
    url: `/${relativePath.replace(/^public\//, '')}`,
  };
});

await writeFile(outputFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
await writeFile(sourceOutputFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
console.log(`Generated ${String(records.length)} music records at ${outputFile}`);
