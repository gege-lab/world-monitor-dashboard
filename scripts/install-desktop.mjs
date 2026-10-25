import fs from 'node:fs/promises';
import path from 'node:path';

const [projectArgument, desktopArgument] = process.argv.slice(2);
if (!projectArgument || !desktopArgument) throw new Error('Project and Desktop paths are required');
const project = await fs.realpath(projectArgument);
const desktop = path.resolve(desktopArgument);
await fs.access(path.join(project, 'server.mjs'));
await fs.mkdir(desktop, { recursive: true });
const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`;
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
for (const [name, script] of [
  ['World Monitor 起動.command', 'start-world-monitor.command'],
  ['World Monitor 終了.command', 'stop-world-monitor.command'],
  ['World Monitor 停止.command', 'stop-world-monitor.command']
]) {
  const destination = path.join(desktop, name);
  const body = `#!/bin/zsh\nexport WORLD_MONITOR_NO_PAUSE=1\nexec ${shellQuote(path.join(project, 'scripts', script))}\n`;
  let old, oldStat;
  try {
    oldStat = await fs.lstat(destination);
    old = await fs.readFile(destination, 'utf8');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (oldStat && (old !== body || oldStat.isSymbolicLink())) {
    const backup = path.join(desktop, 'World Monitor アイコンのバックアップ', stamp, name);
    await fs.mkdir(path.dirname(backup), { recursive: true });
    if (oldStat.isSymbolicLink()) await fs.symlink(await fs.readlink(destination), backup);
    else await fs.copyFile(destination, backup, fs.constants.COPYFILE_EXCL);
  }
  if (old !== body || oldStat?.isSymbolicLink()) {
    const temporary = `${destination}.tmp-${process.pid}`;
    try {
      await fs.writeFile(temporary, body, { mode: 0o755, flag: 'wx' });
      await fs.rename(temporary, destination);
    } finally {
      await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }
  await fs.chmod(destination, 0o755);
  console.log(`作成: ${destination}`);
}
