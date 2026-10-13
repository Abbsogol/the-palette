import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const templates = new Set(['.env.example', '.env.production.example', 'mobile/.env.example', 'mobile/.env.production.example']);

export function prohibitedReleasePaths(paths) {
  return paths.filter(path => {
    if (templates.has(path)) return false;
    return /(?:^|\/)\.env[^/]*$/.test(path)
      || /(?:^|\/)(?:\.backups|\.expo|\.vercel|node_modules|test-results|playwright-report)(?:\/|$)/.test(path)
      || /^mobile\/(?:ios|android)\//.test(path)
      || /\.(?:pem|key|p8|p12|jks|keystore|mobileprovision|dump|sql\.gz)$/i.test(path)
      || /(?:^|\/)(?:screenshot|screen[-_ ]?shot|IMG_\d+)[^/]*\.(?:png|jpe?g|webp|pdf)$/i.test(path);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const prohibited = prohibitedReleasePaths(tracked);
  if (prohibited.length) {
    // Paths only: never dump environment contents or a secret match.
    console.error('Prohibited release artifacts:', prohibited.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`Release artifact check passed: ${tracked.length} tracked paths. Run Gitleaks separately for credential content.`);
  }
}
