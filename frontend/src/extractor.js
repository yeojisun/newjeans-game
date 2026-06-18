/**
 * NewJeans Character Extractor (Pre-separated High Quality Sprites version)
 * Imports 5 regular and 5 cheering digital vector drawings, transparentizes the white background,
 * auto-trims empty margins to prevent hitbox misalignment, and adds a glowing shadow.
 */

import spriteHanni from './assets/sprite_hanni.png';
import spriteDanielle from './assets/sprite_danielle.png';
import spriteHaerin from './assets/sprite_haerin.png';
import spriteMinji from './assets/sprite_minji.png';
import spriteHyein from './assets/sprite_hyein.png';

import cheerHanni from './assets/cheer_hanni.png';
import cheerDanielle from './assets/cheer_danielle.png';
import cheerHaerin from './assets/cheer_haerin.png';
import cheerMinji from './assets/cheer_minji.png';
import cheerHyein from './assets/cheer_hyein.png';

import attackHanni from './assets/attack_hanni.png';
import attackDanielle from './assets/attack_danielle.png';
import attackHaerin from './assets/attack_haerin.png';
import attackMinji from './assets/attack_minji.png';
import attackHyein from './assets/attack_hyein.png';

import hitHaerin from './assets/hit_haerin.png';
import hitHyein from './assets/hit_hyein.png';
import flyHyein from './assets/fly_hyein.png';
import flyDanielle from './assets/fly_danielle.png';


const CHARACTERS_META = [
  {
    id: 'hanni',
    name: '하니 (Hanni)',
    color: '#ff4d8d', // Pink
    role: 'Vocal',
    skillName: 'Hype Dash',
    skillDesc: '순식간에 대시하며 일시적 무적 상태가 됩니다. (방향키/드래그 더블 탭)',
    src: spriteHanni,
    cheerSrc: cheerHanni,
    attackSrc: attackHanni
  },
  {
    id: 'danielle',
    name: '다니엘 (Danielle)',
    color: '#ffb300', // Yellow
    role: 'Sunshine',
    skillName: 'Butterfly Score',
    skillDesc: '점수 획득량이 2배로 증가하고 나비가 날아와 골드를 추가 획득합니다.',
    src: spriteDanielle,
    flySrc: flyDanielle,
    cheerSrc: cheerDanielle,
    attackSrc: attackDanielle
  },
  {
    id: 'haerin',
    name: '해린 (Haerin)',
    color: '#10b981', // Green
    role: 'Kitty',
    skillName: 'Tokki Magnet',
    skillDesc: '강력한 자석 효과로 화면 안의 모든 아이템(토끼, CD)을 끌어당깁니다.',
    src: spriteHaerin,
    cheerSrc: cheerHaerin,
    attackSrc: attackHaerin,
    hitSrc: hitHaerin
  },
  {
    id: 'minji',
    name: '민지 (Minji)',
    color: '#3b82f6', // Blue
    role: 'Leader',
    skillName: 'CD Shield',
    skillDesc: '장애물 충돌을 1회 막아주는 회전하는 CD 보호막을 생성합니다.',
    src: spriteMinji,
    cheerSrc: cheerMinji,
    attackSrc: attackMinji
  },
  {
    id: 'hyein',
    name: '혜인 (Hyein)',
    color: '#8b5cf6', // Purple
    role: 'Maknae',
    skillName: 'Super Slow-Mo',
    skillDesc: '주변 장애물과 스크롤 속도를 느리게 만들어 쉽게 회피할 수 있게 합니다.',
    src: spriteHyein,
    flySrc: flyHyein,
    cheerSrc: cheerHyein,
    attackSrc: attackHyein,
    hitSrc: hitHyein
  }
];

// Process a single image path: load, transparentize, trim, add shadow, return canvas & dataUrl
function processSingleCanvas(src, color) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;

    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // Create initial processing canvas
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Remove white background
      const imgData = ctx.getImageData(0, 0, w, h);
      const pixels = imgData.data;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const avg = (r + g + b) / 3;

        // Turn white/near-white transparent
        if (r > 225 && g > 225 && b > 225) {
          const minBound = 205;
          const maxBound = 235;
          if (avg >= maxBound) {
            pixels[i + 3] = 0; // Transparent
          } else if (avg > minBound) {
            // Smooth edge transition
            const ratio = (maxBound - avg) / (maxBound - minBound);
            pixels[i + 3] = Math.floor(ratio * 255);
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // Auto-trim transparent borders
      let minX = w;
      let maxX = 0;
      let minY = h;
      let maxY = 0;
      let hasContent = false;

      // Re-read pixel transparency to find actual bounding box
      const trimmedData = ctx.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const alphaIdx = (y * w + x) * 4 + 3;
          if (trimmedData[alphaIdx] > 10) { // Non-transparent pixel
            hasContent = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Fallback if no content found
      if (!hasContent) {
        minX = 0; maxX = w; minY = 0; maxY = h;
      }

      const cropW = (maxX - minX) + 1;
      const cropH = (maxY - minY) + 1;

      // Create trimmed sprite canvas
      const trimmedCanvas = document.createElement('canvas');
      trimmedCanvas.width = cropW;
      trimmedCanvas.height = cropH;
      const trimmedCtx = trimmedCanvas.getContext('2d');
      
      // Draw cropped transparent portion
      trimmedCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

      // Create final polished canvas with a glow effect
      const polishedCanvas = document.createElement('canvas');
      const padding = 10;
      polishedCanvas.width = cropW + padding * 2;
      polishedCanvas.height = cropH + padding * 2;
      const polishedCtx = polishedCanvas.getContext('2d');

      polishedCtx.shadowColor = color;
      polishedCtx.shadowBlur = 8;
      polishedCtx.drawImage(trimmedCanvas, padding, padding);

      resolve({
        canvas: polishedCanvas,
        dataUrl: polishedCanvas.toDataURL(),
        width: polishedCanvas.width,
        height: polishedCanvas.height
      });
    };

    img.onerror = (err) => {
      reject(new Error(`이미지 파일 로드에 실패했습니다: ${src}`));
    };
  });
}

function processCharacterSprite(char) {
  const promises = [
    processSingleCanvas(char.src, char.color),
    processSingleCanvas(char.cheerSrc, char.color),
    processSingleCanvas(char.attackSrc, char.color)
  ];
  if (char.hitSrc) {
    promises.push(processSingleCanvas(char.hitSrc, char.color));
  } else {
    promises.push(Promise.resolve(null));
  }
  if (char.flySrc) {
    promises.push(processSingleCanvas(char.flySrc, char.color));
  } else {
    promises.push(Promise.resolve(null));
  }

  return Promise.all(promises).then(([defaultSprite, cheerSprite, attackSprite, hitSprite, flySprite]) => {
    return {
      id: char.id,
      name: char.name,
      color: char.color,
      role: char.role,
      skillName: char.skillName,
      skillDesc: char.skillDesc,
      // Default Sprite
      canvas: defaultSprite.canvas,
      dataUrl: defaultSprite.dataUrl,
      width: defaultSprite.width,
      height: defaultSprite.height,
      // Cheering Sprite
      cheerCanvas: cheerSprite.canvas,
      cheerDataUrl: cheerSprite.dataUrl,
      cheerWidth: cheerSprite.width,
      cheerHeight: cheerSprite.height,
      // Attack Sprite
      attackCanvas: attackSprite.canvas,
      attackDataUrl: attackSprite.dataUrl,
      attackWidth: attackSprite.width,
      attackHeight: attackSprite.height,
      // Hit Sprite
      hitCanvas: hitSprite ? hitSprite.canvas : null,
      hitDataUrl: hitSprite ? hitSprite.dataUrl : null,
      // Fly Sprite
      flyCanvas: flySprite ? flySprite.canvas : null,
      flyDataUrl: flySprite ? flySprite.dataUrl : null
    };
  });
}

export function extractCharacters() {
  const promises = CHARACTERS_META.map(char => processCharacterSprite(char));
  return Promise.all(promises);
}
