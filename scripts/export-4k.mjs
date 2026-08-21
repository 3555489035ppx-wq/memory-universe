#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

function usage() {
  return [
    'Usage:',
    '  node scripts/export-4k.mjs --input <native-4k-visual.webm> --audio <local-master.wav> --output <movie.mp4>',
    '',
    'Optional:',
    '  --ffmpeg <path>     ffmpeg executable (default: ffmpeg on PATH)',
    '  --ffprobe <path>    ffprobe executable (default: ffprobe on PATH)',
    '  --width <pixels>    default: 2160',
    '  --height <pixels>   default: 3840',
    '  --fps <number>      default: 30',
    '  --video-bitrate <rate> default: 40M',
    '  --audio-bitrate <rate> default: 320k',
    '',
    'The script rejects a non-native-size visual input instead of upscaling it and calling the result 4K.',
  ].join('\n');
}

function parseArgs(argv) {
  const result = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key ?? ''}`);
    if (key === '--help') {
      result.set('help', 'true');
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    result.set(key.slice(2), value);
    index += 1;
  }
  return result;
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited with ${String(code)}\n${stderr}`));
    });
  });
}

async function ensureReadable(path, label) {
  try {
    await access(path, constants.R_OK);
  } catch {
    throw new Error(`${label} cannot be read: ${path}`);
  }
}

async function inspectVideo(ffprobe, input) {
  const { stdout } = await run(ffprobe, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,pix_fmt,color_space,color_transfer,color_primaries',
    '-of', 'json',
    input,
  ]);
  const parsed = JSON.parse(stdout);
  const stream = parsed.streams?.[0];
  if (!stream || typeof stream.width !== 'number' || typeof stream.height !== 'number') {
    throw new Error('Input has no readable video stream.');
  }
  return stream;
}

async function inspectOutput(ffprobe, output) {
  const { stdout } = await run(ffprobe, [
    '-v', 'error',
    '-show_entries', 'format=duration,size:stream=index,codec_type,codec_name,width,height,avg_frame_rate,pix_fmt,sample_rate,channels',
    '-of', 'json',
    output,
  ]);
  return JSON.parse(stdout);
}

const args = parseArgs(process.argv.slice(2));
if (args.has('help')) {
  process.stdout.write(`${usage()}\n`);
  process.exit(0);
}

const input = args.get('input');
const audio = args.get('audio');
const output = args.get('output');
if (!input || !audio || !output) {
  process.stderr.write(`${usage()}\n`);
  process.exit(2);
}

const width = Number(args.get('width') ?? '2160');
const height = Number(args.get('height') ?? '3840');
const fps = Number(args.get('fps') ?? '30');
if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || !Number.isFinite(fps) || fps <= 0) {
  throw new Error('width, height, and fps must be valid positive numbers.');
}

const ffmpeg = args.get('ffmpeg') ?? 'ffmpeg';
const ffprobe = args.get('ffprobe') ?? 'ffprobe';
const resolvedInput = resolve(input);
const resolvedAudio = resolve(audio);
const resolvedOutput = resolve(output);
await Promise.all([
  ensureReadable(resolvedInput, 'Visual input'),
  ensureReadable(resolvedAudio, 'Audio input'),
]);

const source = await inspectVideo(ffprobe, resolvedInput);
if (source.width !== width || source.height !== height) {
  throw new Error(
    `Refusing fake 4K: visual input is ${String(source.width)}x${String(source.height)}, expected ${String(width)}x${String(height)}. Render a native target-size intermediate first.`,
  );
}

const videoBitrate = args.get('video-bitrate') ?? '40M';
const audioBitrate = args.get('audio-bitrate') ?? '320k';
process.stdout.write(`Encoding native ${String(width)}x${String(height)} at ${String(fps)} fps to MP4...\n`);
await run(ffmpeg, [
  '-y',
  '-i', resolvedInput,
  '-i', resolvedAudio,
  '-map', '0:v:0',
  '-map', '1:a:0',
  '-c:v', 'libx264',
  '-profile:v', 'high',
  '-level:v', '5.1',
  '-pix_fmt', 'yuv420p',
  '-r', String(fps),
  '-g', String(Math.max(1, Math.round(fps * 2))),
  '-b:v', videoBitrate,
  '-maxrate', '60M',
  '-bufsize', '80M',
  '-color_primaries', 'bt709',
  '-color_trc', 'bt709',
  '-colorspace', 'bt709',
  '-c:a', 'aac',
  '-b:a', audioBitrate,
  '-ar', '48000',
  '-ac', '2',
  '-movflags', '+faststart',
  '-shortest',
  resolvedOutput,
]);

const inspection = await inspectOutput(ffprobe, resolvedOutput);
const video = inspection.streams?.find((stream) => stream.codec_type === 'video');
const audioStream = inspection.streams?.find((stream) => stream.codec_type === 'audio');
if (video?.width !== width || video?.height !== height || !audioStream) {
  throw new Error(`Validation failed after encoding: ${JSON.stringify(inspection)}`);
}
process.stdout.write(`${JSON.stringify({ output: resolvedOutput, width, height, fps, inspection }, null, 2)}\n`);
