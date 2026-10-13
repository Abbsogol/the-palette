import { readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

function images(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? images(path) : /\.(png|jpe?g)$/i.test(path) ? [path] : [];
  });
}

test('native raster assets use extensions matching their encoded formats', () => {
  const assets = images(join(__dirname, '../assets'));
  expect(assets.length).toBeGreaterThan(0);
  for (const path of assets) {
    const signature = readFileSync(path).subarray(0, 8);
    if (extname(path) === '.png') {
      expect({ path, signature: [...signature] }).toEqual({ path, signature: [137, 80, 78, 71, 13, 10, 26, 10] });
    } else {
      expect({ path, signature: [...signature.subarray(0, 3)] }).toEqual({ path, signature: [255, 216, 255] });
    }
  }
});
