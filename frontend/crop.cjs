const { Jimp } = require('jimp');
const path = require('path');

const srcPath = 'C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781683978653.jpg';
const destDir = path.join(__dirname, 'src', 'assets');

// Helper functions for drawing and rasterization (used for patching cut-off graphics)
function sign(p1x, p1y, p2x, p2y, p3x, p3y) {
  return (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
}

function pointInTriangle(px, py, v1x, v1y, v2x, v2y, v3x, v3y) {
  const d1 = sign(px, py, v1x, v1y, v2x, v2y);
  const d2 = sign(px, py, v2x, v2y, v3x, v3y);
  const d3 = sign(px, py, v3x, v3y, v1x, v1y);

  const has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);

  return !(has_neg && has_pos);
}

function fillTriangle(img, v1x, v1y, v2x, v2y, v3x, v3y, colorHex) {
  const minX = Math.floor(Math.min(v1x, v2x, v3x));
  const maxX = Math.ceil(Math.max(v1x, v2x, v3x));
  const minY = Math.floor(Math.min(v1y, v2y, v3y));
  const maxY = Math.ceil(Math.max(v1y, v2y, v3y));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInTriangle(x, y, v1x, v1y, v2x, v2y, v3x, v3y)) {
        img.setPixelColor(colorHex, x, y);
      }
    }
  }
}

function drawThickLine(img, x0, y0, x1, y1, thickness, color) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = (x0 < x1) ? 1 : -1;
  const sy = (y0 < y1) ? 1 : -1;
  let err = dx - dy;
  
  const half = Math.floor(thickness / 2);
  
  while (true) {
    for (let bx = -half; bx <= half; bx++) {
      for (let by = -half; by <= half; by++) {
        const px = x0 + bx;
        const py = y0 + by;
        if (px >= 0 && px < img.bitmap.width && py >= 0 && py < img.bitmap.height) {
          img.setPixelColor(color, px, py);
        }
      }
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}


// Flood-fill based transparentizer to clean up off-white/beige paper texture backgrounds
function removeBackgroundDirect(image, threshold = 60) {
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const data = image.bitmap.data;
  
  // Sample background color. Look for a light off-white/beige pixel near the top corner
  let bgR = data[0];
  let bgG = data[1];
  let bgB = data[2];
  
  if (bgR < 180 || bgG < 180 || bgB < 180) {
    let found = false;
    for (let dy = 0; dy < 30; dy++) {
      for (let dx = 0; dx < 30; dx++) {
        const idx = (dy * w + dx) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        if (r > 200 && g > 200 && b > 200) {
          bgR = r;
          bgG = g;
          bgB = b;
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }
  
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

  console.log('Loading individual cheer sprite...');
  const cheer = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781684176865.png');
  removeBackgroundDirect(cheer);
  await cheer.write(path.join(destDir, 'cheer_haerin.png'));
  console.log('Saved cheer_haerin.png');

  console.log('Cropping attack sprite...');
  const attack = image.clone().crop({ x: attackBox.x, y: attackBox.y, w: attackBox.w, h: attackBox.h });
  removeBackgroundDirect(attack);
  await attack.write(path.join(destDir, 'attack_haerin.png'));
  console.log('Saved attack_haerin.png');

  console.log('Loading individual hit sprite...');
  const hit = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781684277849.png');
  removeBackgroundDirect(hit);
  await hit.write(path.join(destDir, 'hit_haerin.png'));
  console.log('Saved hit_haerin.png');

  console.log('Loading individual Hyein main sprite...');
  const hyeinSprite = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781742263301.png');
  removeBackgroundDirect(hyeinSprite);
  await hyeinSprite.write(path.join(destDir, 'sprite_hyein.png'));
  console.log('Saved sprite_hyein.png');

  console.log('Loading individual Hyein fly sprite...');
  const hyeinFly = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781743825774.png');
  removeBackgroundDirect(hyeinFly);
  await hyeinFly.write(path.join(destDir, 'fly_hyein.png'));
  console.log('Saved fly_hyein.png');

  console.log('Loading individual Hyein cheer sprite...');
  const hyeinCheer = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781742409477.png');
  removeBackgroundDirect(hyeinCheer);
  await hyeinCheer.write(path.join(destDir, 'cheer_hyein.png'));
  console.log('Saved cheer_hyein.png');

  console.log('Loading individual Hyein hit sprite...');
  const hyeinHit = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781742875552.png');
  removeBackgroundDirect(hyeinHit);
  await hyeinHit.write(path.join(destDir, 'hit_hyein.png'));
  console.log('Saved hit_hyein.png');

  console.log('Loading individual Hyein attack sprite...');
  const hyeinAttack = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781744623619.png');
  removeBackgroundDirect(hyeinAttack);
  await hyeinAttack.write(path.join(destDir, 'attack_hyein.png'));
  console.log('Saved attack_hyein.png');

  console.log('Loading individual Danielle main sprite...');
  const danielleSprite = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781745774754.png');
  removeBackgroundDirect(danielleSprite);
  await danielleSprite.write(path.join(destDir, 'sprite_danielle.png'));
  console.log('Saved sprite_danielle.png');

  console.log('Loading individual Danielle cheer sprite...');
  const danielleCheer = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781745785614.png');
  removeBackgroundDirect(danielleCheer);
  await danielleCheer.write(path.join(destDir, 'cheer_danielle.png'));
  console.log('Saved cheer_danielle.png');

  console.log('Loading individual Danielle fly sprite...');
  const danielleFly = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781746268057.png');
  removeBackgroundDirect(danielleFly);
  await danielleFly.write(path.join(destDir, 'fly_danielle.png'));
  console.log('Saved fly_danielle.png');

  console.log('Loading individual Danielle hit sprite...');
  const danielleHit = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781746546688.png');
  removeBackgroundDirect(danielleHit);
  await danielleHit.write(path.join(destDir, 'hit_danielle.png'));
  console.log('Saved hit_danielle.png');

  console.log('Loading individual Danielle attack sprite...');
  const danielleAttack = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781746558037.png');
  removeBackgroundDirect(danielleAttack);
  await danielleAttack.write(path.join(destDir, 'attack_danielle.png'));
  console.log('Saved attack_danielle.png');

  console.log('Loading individual Hanni main sprite...');
  const hanniSprite = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781766700420.png');
  removeBackgroundDirect(hanniSprite);
  await hanniSprite.write(path.join(destDir, 'sprite_hanni.png'));
  console.log('Saved sprite_hanni.png');

  console.log('Loading individual Hanni fly sprite...');
  const hanniFly = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781766722879.png');
  removeBackgroundDirect(hanniFly);
  await hanniFly.write(path.join(destDir, 'fly_hanni.png'));
  console.log('Saved fly_hanni.png');

  console.log('Loading and patching individual Hanni attack sprite...');
  const hanniAttackRaw = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781766743157.png');
  const yellowColor = hanniAttackRaw.getPixelColor(150, 110);
  
  // Clean up white background first
  removeBackgroundDirect(hanniAttackRaw);
  
  // Expand width to 220 to prevent cutting off the new spikes
  const hanniAttackPatched = new Jimp({ width: 220, height: hanniAttackRaw.bitmap.height, color: 0x00000000 });
  hanniAttackPatched.composite(hanniAttackRaw, 0, 0);

  // Re-draw cut-off yellow attack spikes
  fillTriangle(hanniAttackPatched, 161, 80, 188, 85, 161, 102, yellowColor);
  fillTriangle(hanniAttackPatched, 161, 102, 205, 112, 161, 128, yellowColor);
  fillTriangle(hanniAttackPatched, 161, 128, 185, 138, 161, 145, yellowColor);
  
  // Draw black boundaries for spikes
  const blackColor = 0x000000ff;
  const lineThickness = 3;
  drawThickLine(hanniAttackPatched, 161, 80, 188, 85, lineThickness, blackColor);
  drawThickLine(hanniAttackPatched, 188, 85, 161, 102, lineThickness, blackColor);
  drawThickLine(hanniAttackPatched, 161, 102, 205, 112, lineThickness, blackColor);
  drawThickLine(hanniAttackPatched, 205, 112, 161, 128, lineThickness, blackColor);
  drawThickLine(hanniAttackPatched, 161, 128, 185, 138, lineThickness, blackColor);
  drawThickLine(hanniAttackPatched, 185, 138, 161, 145, lineThickness, blackColor);

  await hanniAttackPatched.write(path.join(destDir, 'attack_hanni.png'));
  console.log('Saved attack_hanni.png (with reconstructed splash)');

  console.log('Loading individual Hanni cheer sprite...');
  const hanniCheer = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781767421100.png');
  removeBackgroundDirect(hanniCheer);
  await hanniCheer.write(path.join(destDir, 'cheer_hanni.png'));
  console.log('Saved cheer_hanni.png');

  console.log('Loading individual Hanni hit sprite...');
  const hanniHit = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781767427124.png');
  removeBackgroundDirect(hanniHit);
  await hanniHit.write(path.join(destDir, 'hit_hanni.png'));
  console.log('Saved hit_hanni.png');

  console.log('Loading individual Minji main sprite...');
  const minjiSprite = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781768383834.png');
  removeBackgroundDirect(minjiSprite);
  await minjiSprite.write(path.join(destDir, 'sprite_minji.png'));
  console.log('Saved sprite_minji.png');

  console.log('Loading individual Minji cheer sprite...');
  const minjiCheer = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781768393716.png');
  removeBackgroundDirect(minjiCheer);
  await minjiCheer.write(path.join(destDir, 'cheer_minji.png'));
  console.log('Saved cheer_minji.png');

  console.log('Loading individual Minji fly sprite...');
  const minjiFly = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781768406055.png');
  removeBackgroundDirect(minjiFly);
  await minjiFly.write(path.join(destDir, 'fly_minji.png'));
  console.log('Saved fly_minji.png');

  console.log('Loading individual Minji attack sprite...');
  const minjiAttack = await Jimp.read('C:/Users/jisun.yeo/.gemini/antigravity/brain/71e6e127-5b58-4134-b553-f1a41d12ff3e/media__1781768416869.png');
  removeBackgroundDirect(minjiAttack);
  await minjiAttack.write(path.join(destDir, 'attack_minji.png'));
  console.log('Saved attack_minji.png');

  console.log('All crops and background transparentization completed successfully!');
}

cropAll().catch(err => {
  console.error('Error cropping:', err);
});
