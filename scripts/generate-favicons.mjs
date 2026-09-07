/** Trace the portrait's dark ink into transparent vector icons and export browser fallbacks. */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const { data, info } = await sharp('public/portrait.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const ink = new Uint8Array(width * height);
let minX = width, minY = height, maxX = 0, maxY = 0;
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const pixel = y * width + x;
  const offset = pixel * 4;
  if (data[offset + 3] > 128 && (data[offset] + data[offset + 1] + data[offset + 2]) / 3 < 128) {
    ink[pixel] = 1;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
}

const stride = width + 1;
const edges = new Map();
/** Append an oriented edge to the boundary graph. */
function edge(x, y, nextX, nextY) {
  const from = y * stride + x;
  const to = nextY * stride + nextX;
  if (!edges.has(from)) edges.set(from, []);
  edges.get(from).push(to);
}

// Trace only the boundaries; white facial regions and transparent pixels become empty space.
for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
  if (!ink[y * width + x]) continue;
  if (!ink[(y - 1) * width + x]) edge(x, y, x + 1, y);
  if (!ink[y * width + x + 1]) edge(x + 1, y, x + 1, y + 1);
  if (!ink[(y + 1) * width + x]) edge(x + 1, y + 1, x, y + 1);
  if (!ink[y * width + x - 1]) edge(x, y + 1, x, y);
}

/** Reduce pixel stair-steps to vector segments, keeping errors below one rendered icon pixel. */
function simplify(points, tolerance = 1.5) {
  if (points.length <= 2) return points;
  const first = points[0], last = points.at(-1);
  const dx = last[0] - first[0], dy = last[1] - first[1];
  const length = dx * dx + dy * dy;
  let farthest = tolerance * tolerance, split = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    const t = length ? Math.max(0, Math.min(1, ((point[0] - first[0]) * dx + (point[1] - first[1]) * dy) / length)) : 0;
    const distance = (point[0] - first[0] - t * dx) ** 2 + (point[1] - first[1] - t * dy) ** 2;
    if (distance > farthest) { farthest = distance; split = i; }
  }
  if (!split) return [first, last];
  return [...simplify(points.slice(0, split + 1), tolerance).slice(0, -1), ...simplify(points.slice(split), tolerance)];
}

const contours = [];
while (edges.size) {
  const start = edges.keys().next().value;
  let current = start;
  const points = [];
  do {
    points.push([current % stride, Math.floor(current / stride)]);
    const options = edges.get(current);
    if (!options?.length) throw new Error('Portrait contour did not close.');
    const next = options.pop();
    if (!options.length) edges.delete(current);
    current = next;
  } while (current !== start);
  const area = Math.abs(points.reduce((sum, point, i) => {
    const next = points[(i + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2);
  if (area < 30) continue;
  contours.push(simplify([...points, points[0]]));
}

const side = Math.max(maxX - minX + 1, maxY - minY + 1);
const scale = 14.5 / side;
const centerX = (minX + maxX + 1) / 2, centerY = (minY + maxY + 1) / 2;
const path = contours.map(points => points.map(([x, y], i) => `${i ? 'L' : 'M'}${(8 + (x - centerX) * scale).toFixed(3)} ${(8 + (y - centerY) * scale).toFixed(3)}`).join('') + 'Z').join('');
const svg = (fill, adaptive = false) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${adaptive ? '<style>path{fill:#262626}@media(prefers-color-scheme:dark){path{fill:#fafafa}}</style>' : ''}<path fill="${fill}" fill-rule="evenodd" d="${path}"/></svg>\n`;
await writeFile('public/favicon.svg', svg('#262626', true));
await writeFile('public/favicon-light.svg', svg('#262626'));
await writeFile('public/favicon-dark.svg', svg('#fafafa'));
await writeFile('public/safari-pinned-tab.svg', svg('#000000'));
for (const [theme, fill] of [['light', '#262626'], ['dark', '#fafafa']]) {
  await sharp(Buffer.from(svg(fill))).resize(32, 32).png().toFile(`public/favicon-${theme}.png`);
}
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(size => sharp(Buffer.from(svg('#262626'))).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, i) => {
  const entry = 6 + 16 * i;
  header[entry] = sizes[i]; header[entry + 1] = sizes[i];
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile('public/favicon.ico', Buffer.concat([header, ...images]));
console.log(`Exported ${contours.length} portrait contours; SVG ${(Buffer.byteLength(svg('#262626')) / 1024).toFixed(1)} KB.`);
