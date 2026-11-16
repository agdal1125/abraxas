// Renders and encodes the opening film. See assets/source/cinematics/provenance.md.
//   node scripts/render-prelude.mjs frames [--t 12.5,30] [--draft] [--start N] [--end N]
//   node scripts/render-prelude.mjs encode
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'assets/source/cinematics');
const out = join(source, 'prelude-v3/out');
const frames = join(out, 'frames');
const output = join(root, 'client/public/cinematics/prelude-v3.mp4');
const DURATION = '51.42';
const TITLE_AT = '47.24';
// 13 MiB folder limit minus the audio track and the credits file.
const VIDEO_BITRATE = '1900k';

const defaultBlender = {
  win32: 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe',
  darwin: '/Applications/Blender.app/Contents/MacOS/Blender',
}[process.platform] ?? 'blender';
const blender = process.env.ABRAXAS_BLENDER || defaultBlender;
const ffmpeg = process.env.ABRAXAS_FFMPEG || 'ffmpeg';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: root });
  if (result.error || result.status !== 0) throw result.error ?? Error(`${command} exited with ${result.status}`);
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function renderFrames(args) {
  const stills = option(args, '--t');
  const draft = args.includes('--draft');
  const start = option(args, '--start');
  const end = option(args, '--end');
  const script = ['-b', '--factory-startup', '--python-exit-code', '1', '-P', join(source, 'prelude-v3/build_film.py'), '--'];
  if (stills) {
    run(blender, [...script, '--t', stills, '--out', join(out, 'stills')]);
  } else if (draft) {
    run(blender, [...script, '--out', join(out, 'draft'), '--width', '640', '--samples', '16', '--fps', '12']);
  } else {
    if (!start) rmSync(frames, { recursive: true, force: true });
    mkdirSync(frames, { recursive: true });
    run(blender, [...script, '--out', frames, '--samples', '64', ...(start ? ['--start', start] : []), ...(end ? ['--end', end] : [])]);
  }
}

function encode() {
  if (!existsSync(frames) || readdirSync(frames).length === 0) throw Error('Render the frames first');
  const graph = "[1:v]format=rgba[title];[0:v][title]overlay=0:0:eof_action=repeat,format=yuv420p[v]";
  const input = [
    '-y', '-framerate', '24', '-i', join(frames, '%04d.png'),
    '-framerate', '24', '-itsoffset', TITLE_AT, '-i', join(source, 'prelude-v3/title/%06d.png'),
    '-i', join(source, 'prelude-audio-v1.m4a'),
    '-filter_complex', graph, '-map', '[v]', '-t', DURATION,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryslow', '-b:v', VIDEO_BITRATE,
  ];
  const log = join(out, 'x264-pass');
  run(ffmpeg, [...input, '-pass', '1', '-passlogfile', log, '-an', '-f', 'mp4', join(out, 'pass1.mp4')]);
  run(ffmpeg, [...input, '-pass', '2', '-passlogfile', log, '-map', '2:a', '-c:a', 'copy', '-movflags', '+faststart', output]);
  rmSync(join(out, 'pass1.mp4'), { force: true });
}

const [command, ...args] = process.argv.slice(2);
if (command === 'frames') renderFrames(args);
else if (command === 'encode') encode();
else throw Error('Usage: node scripts/render-prelude.mjs frames [--t 12.5,30] [--draft] [--start N] [--end N] | encode');
