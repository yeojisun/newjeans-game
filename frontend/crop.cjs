const { Jimp } = require('jimp');
const path = require('path');

const srcPath = 'C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781683581187.jpg';
const destDir = path.join(__dirname, 'src', 'assets');

async function cropAll() {
  console.log('Loading image...');
  const image = await Jimp.read(srcPath);
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  console.log(`Dimensions: ${w}x${h}`);

  // Standing Front (Pose 1a)
  // Coordinates based on 1024x1024 grid
  const scale = w / 1024;
  
  const standingBox = {
    x: Math.floor(55 * scale),
    y: Math.floor(330 * scale),
    w: Math.floor(205 * scale),
    h: Math.floor(290 * scale)
  };

  // Smiling Manse (Pose 2b)
  const cheerBox = {
    x: Math.floor(740 * scale),
    y: Math.floor(330 * scale),
    w: Math.floor(230 * scale),
    h: Math.floor(290 * scale)
  };

  // Attacking Right (Pose 3b)
  const attackBox = {
    x: Math.floor(260 * scale),
    y: Math.floor(680 * scale),
    w: Math.floor(240 * scale),
    h: Math.floor(270 * scale)
  };

  console.log('Cropping standing sprite...');
  const standing = image.clone().crop({ x: standingBox.x, y: standingBox.y, w: standingBox.w, h: standingBox.h });
  await standing.write(path.join(destDir, 'sprite_haerin.png'));
  console.log('Saved sprite_haerin.png');

  console.log('Cropping cheer sprite...');
  const cheer = image.clone().crop({ x: cheerBox.x, y: cheerBox.y, w: cheerBox.w, h: cheerBox.h });
  await cheer.write(path.join(destDir, 'cheer_haerin.png'));
  console.log('Saved cheer_haerin.png');

  console.log('Cropping attack sprite...');
  const attack = image.clone().crop({ x: attackBox.x, y: attackBox.y, w: attackBox.w, h: attackBox.h });
  await attack.write(path.join(destDir, 'attack_haerin.png'));
  console.log('Saved attack_haerin.png');

  console.log('All crops completed successfully!');
}

cropAll().catch(err => {
  console.error('Error cropping:', err);
});
