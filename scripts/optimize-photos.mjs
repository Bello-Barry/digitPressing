import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const PHOTOS_DIR = path.join(process.cwd(), 'public', 'photos');
const MAX_WIDTH = 2000;
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

async function optimizePhotos() {
  try {
    const files = await fs.readdir(PHOTOS_DIR);
    console.log(`Checking photos in ${PHOTOS_DIR}...`);

    for (const file of files) {
      if (!/\.(png|jpg|jpeg|webp)$/i.test(file)) continue;

      const filePath = path.join(PHOTOS_DIR, file);
      const stat = await fs.stat(filePath);
      const image = sharp(filePath);
      const metadata = await image.metadata();

      const needsResize = metadata.width && metadata.width > 2400;
      const needsCompress = stat.size > MAX_SIZE_BYTES;

      if (needsResize || needsCompress) {
        console.log(`Optimizing ${file} (${(stat.size / (1024 * 1024)).toFixed(2)} MB, ${metadata.width}x${metadata.height})...`);

        let pipeline = sharp(filePath);

        if (needsResize) {
          pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
        }

        const ext = path.extname(file).toLowerCase();
        let buffer;

        if (ext === '.png') {
          buffer = await pipeline.png({ quality: 82, compressionLevel: 8 }).toBuffer();
        } else if (ext === '.jpg' || ext === '.jpeg') {
          buffer = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
        } else if (ext === '.webp') {
          buffer = await pipeline.webp({ quality: 82 }).toBuffer();
        } else {
          buffer = await pipeline.toBuffer();
        }

        await fs.writeFile(filePath, buffer);
        const newStat = await fs.stat(filePath);
        console.log(`✓ ${file} optimized: ${(stat.size / (1024 * 1024)).toFixed(2)} MB -> ${(newStat.size / (1024 * 1024)).toFixed(2)} MB`);
      } else {
        console.log(`✓ ${file} is within size limits (${(stat.size / (1024 * 1024)).toFixed(2)} MB, ${metadata.width}x${metadata.height}).`);
      }
    }
  } catch (err) {
    console.error('Error optimizing photos:', err);
  }
}

optimizePhotos();
