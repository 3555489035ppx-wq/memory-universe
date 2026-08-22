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
  ['fu-shi-shan-xia-chen-yixun.mp3', {
    id: 'highschool_02',
    title: '富士山下', artist: '陈奕迅', category: '高中回忆',
  }],
  ['mai-en-li-fang-datong.mp3', {
    id: 'highschool_03',
    title: '麦恩莉', artist: '方大同', category: '高中回忆',
  }],
  ['wo-huai-nian-de-sun-yanzi.mp3', {
    id: 'highschool_04',
    title: '我怀念的', artist: '孙燕姿', category: '高中回忆',
  }],
  ['wo-men-de-ge-wang-lihong.mp3', {
    id: 'highschool_05',
    title: '我们的歌', artist: '王力宏', category: '高中回忆',
  }],
  ['wo-men-liang-guo-ding.mp3', {
    id: 'highschool_06',
    title: '我们俩', artist: '郭顶', category: '高中回忆',
  }],
  ['wo-zhi-dao-by2.mp3', {
    id: 'highschool_07',
    title: '我知道', artist: 'BY2', category: '高中回忆',
  }],
  ['yu-ai-yang-chenglin.mp3', {
    id: 'highschool_08',
    title: '雨爱', artist: '杨丞琳', category: '高中回忆',
  }],
  ['yu-xia-yi-zheng-wan-zhou-jielun.mp3', {
    id: 'highschool_09',
    title: '雨下一整晚', artist: '周杰伦', category: '高中回忆',
  }],
  ['yuan-yu-chou-lin-junjie.mp3', {
    id: 'highschool_10',
    title: '愿与愁', artist: '林俊杰', category: '高中回忆',
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

records.sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));

await writeFile(outputFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
await writeFile(sourceOutputFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
console.log(`Generated ${String(records.length)} music records at ${outputFile}`);
