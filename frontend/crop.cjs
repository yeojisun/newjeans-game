const { Jimp } = require('jimp');
const path = require('path');

const srcPath = 'C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781683978653.jpg';
const destDir = path.join(__dirname, 'src', 'assets');

// Flood-fill based transparentizer to clean up off-white/beige paper texture backgrounds
function removeBackgroundDirect(image, threshold = 60) {
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const data = image.bitmap.data;
  
  // Sample background color at (0, 0)
  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];
  
  console.log(`Sampling background color: RGB(${bgR}, ${bgG}, ${bgB})`);

  const visited = new Uint8Array(w * h);
  const queue = [];
  
  // Helper to add pixel to queue
  function enqueue(x, y) {
    const idx = y * w + x;
    if (!visited[idx]) {
      visited[idx] = 1;
      queue.push({ x, y });
    }
  }
  
  // Add all border pixels
  for (let x = 0; x < w; x++) {
    enqueue(x, 0);
    enqueue(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    enqueue(0, y);
    enqueue(w - 1, y);
  }
  
  let clearedCount = 0;
  while (queue.length > 0) {
    const { x, y } = queue.shift();
    const idx = (y * w + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    
    const dist = Math.sqrt(
      Math.pow(r - bgR, 2) +
      Math.pow(g - bgG, 2) +
      Math.pow(b - bgB, 2)
    );
    
    if (dist < threshold) {
      // Clear this pixel (make it transparent)
      data[idx + 3] = 0; // Alpha = 0
      clearedCount++;
      
      // Add neighbors
      if (x > 0) enqueue(x - 1, y);
      if (x < w - 1) enqueue(x + 1, y);
      if (y > 0) enqueue(x, y - 1);
      if (y < h - 1) enqueue(x, y + 1);
    }
  }
  console.log(`Cleared ${clearedCount} background pixels.`);
}

async function cropAll() {
  console.log('Loading image...');
  const image = await Jimp.read(srcPath);
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  console.log(`Dimensions: ${w}x${h}`);

  const scale = w / 1024;
  
  // Coordinates based on 1024x1024 grid
  const standingBox = {
    x: Math.floor(55 * scale),
    y: Math.floor(330 * scale),
    w: Math.floor(205 * scale),
    h: Math.floor(290 * scale)
  };

  const cheerBox = {
    x: Math.floor(740 * scale),
    y: Math.floor(330 * scale),
    w: Math.floor(230 * scale),
    h: Math.floor(290 * scale)
  };

  const attackBox = {
    x: Math.floor(260 * scale),
    y: Math.floor(680 * scale),
    w: Math.floor(240 * scale),
    h: Math.floor(270 * scale)
  };

  console.log('Cropping standing sprite...');
  const standing = image.clone().crop({ x: standingBox.x, y: standingBox.y, w: standingBox.w, h: standingBox.h });
  removeBackgroundDirect(standing);
  await standing.write(path.join(destDir, 'sprite_haerin.png'));
  console.log('Saved sprite_haerin.png');

  console.log('Cropping cheer sprite...');
  const cheer = image.clone().crop({ x: cheerBox.x, y: cheerBox.y, w: cheerBox.w, h: cheerBox.h });
  removeBackgroundDirect(cheer);
  await cheer.write(path.join(destDir, 'cheer_haerin.png'));
  console.log('Saved cheer_haerin.png');

  console.log('Cropping attack sprite...');
  const attack = image.clone().crop({ x: attackBox.x, y: attackBox.y, w: attackBox.w, h: attackBox.h });
  removeBackgroundDirect(attack);
  await attack.write(path.join(destDir, 'attack_haerin.png'));
  console.log('Saved attack_haerin.png');

  console.log('All crops and background transparentization completed successfully!');
}

cropAll().catch(err => {
  console.error('Error cropping:', err);
});
