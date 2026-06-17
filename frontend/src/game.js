import audio from './audio';

export class GameEngine {
  constructor(canvas, character, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.character = character;
    
    // Callbacks to update Vue UI
    this.onScoreUpdate = callbacks.onScoreUpdate || (() => {});
    this.onGameOver = callbacks.onGameOver || (() => {});
    this.onSkillUpdate = callbacks.onSkillUpdate || (() => {});
    this.onSkillActive = callbacks.onSkillActive || (() => {});

    // Game configurations
    this.width = 960;
    this.height = 540;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.isPlaying = false;
    this.score = 0;
    this.distance = 0;
    this.timeScale = 1.0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;

    // Controls
    this.keys = {};
    this.mouse = { x: 100, y: 270, isDown: false };
    this.controlMode = 'keyboard'; // 'keyboard' or 'mouse'

    // Player Object
    this.player = {
      x: 100,
      y: 270,
      width: 65,
      height: 65,
      vx: 0,
      vy: 0,
      speed: 7,
      hp: 3,
      maxHp: 3,
      skillGauge: 0,
      isInvincible: false,
      invincibleTimer: 0,
      activeSkillTimer: 0,
      isSkillActive: false,
      hasShield: false,
      shieldHp: 0,
      bounceScale: 1.0, // Juicy scale multiplier when eating items
      attackTimer: 0,
      eatTimer: 0,
      hitAnimTimer: 0
    };

    // Keep aspect ratio of the extracted character sprite
    if (this.character && this.character.canvas) {
      const ratio = this.character.canvas.width / this.character.canvas.height;
      this.player.width = 65 * Math.min(1.2, Math.max(0.8, ratio));
      this.player.height = 65;
    }

    // Entities
    this.projectiles = [];
    this.collectibles = [];
    this.obstacles = [];
    this.particles = [];
    this.bgStars = [];
    this.bgClouds = [];

    // Timers
    this.spawnTimers = {
      collectible: 0,
      obstacle: 0,
      bgStar: 0
    };

    this.lastTime = 0;
    this.shootCooldown = 0;

    // Initialize parallax background stars
    for (let i = 0; i < 40; i++) {
      this.bgStars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.5 + 0.1
      });
    }

    // Setup input listeners
    this.initInputs();
  }

  initInputs() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      this.controlMode = 'keyboard';
      
      // Prevent browser scroll with arrows & space
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      // Shoot
      if (e.code === 'Space') {
        this.shoot();
      }

      // Trigger Skill
      if ((e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && this.player.skillGauge >= 100) {
        this.activateSkill();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    const updateMousePos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      const scaleY = this.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    };

    this.canvas.addEventListener('mousemove', (e) => {
      updateMousePos(e);
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.controlMode = 'mouse';
      this.mouse.isDown = true;
      updateMousePos(e);
      this.shoot();
    });

    window.addEventListener('mouseup', () => {
      this.mouse.isDown = false;
    });

    // Touch Support
    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.controlMode = 'mouse';
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / rect.width;
        const scaleY = this.height / rect.height;
        this.mouse.x = (e.touches[0].clientX - rect.left) * scaleX;
        this.mouse.y = (e.touches[0].clientY - rect.top) * scaleY;
      }
      e.preventDefault();
    }, { passive: false });

    this.canvas.addEventListener('touchstart', (e) => {
      this.controlMode = 'mouse';
      this.mouse.isDown = true;
      if (e.touches.length > 0) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / rect.width;
        const scaleY = this.height / rect.height;
        this.mouse.x = (e.touches[0].clientX - rect.left) * scaleX;
        this.mouse.y = (e.touches[0].clientY - rect.top) * scaleY;
        this.shoot();
      }
      e.preventDefault();
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => {
      this.mouse.isDown = false;
    });
  }

  start() {
    this.isPlaying = true;
    this.score = 0;
    this.player.hp = this.player.maxHp;
    this.player.skillGauge = 0;
    this.player.x = 100;
    this.player.y = 270;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.isInvincible = false;
    this.player.invincibleTimer = 0;
    this.player.isSkillActive = false;
    this.player.activeSkillTimer = 0;
    this.player.hasShield = false;
    this.player.attackTimer = 0;
    this.player.eatTimer = 0;
    this.player.hitAnimTimer = 0;

    this.projectiles = [];
    this.collectibles = [];
    this.obstacles = [];
    this.particles = [];

    this.onScoreUpdate(this.score);
    this.onSkillUpdate(this.player.skillGauge);
    
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    audio.startBgm();
  }

  stop() {
    this.isPlaying = false;
    audio.stopBgm();
  }

  triggerShake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  shoot() {
    if (!this.isPlaying || this.shootCooldown > 0) return;

    this.player.attackTimer = 10; // Show attack sprite for ~160ms (10 frames)

    // Double fire for Hanni or Danielle during skill
    const projectileCount = (this.character.id === 'hanni' && this.player.isSkillActive) ? 3 : 1;

    for (let i = 0; i < projectileCount; i++) {
      let offset = 0;
      let vy = 0;
      if (projectileCount > 1) {
        offset = (i - 1) * 15;
        vy = (i - 1) * 2;
      }

      this.projectiles.push({
        x: this.player.x + this.player.width,
        y: this.player.y + this.player.height / 2 + offset,
        vx: 12,
        vy: vy,
        radius: 6,
        color: this.character.color
      });
    }

    this.shootCooldown = 12; // frame count cooldown (~200ms)
    audio.playJump();
  }

  activateSkill() {
    if (this.player.skillGauge < 100 || this.player.isSkillActive) return;
    
    this.player.skillGauge = 0;
    this.player.isSkillActive = true;
    this.onSkillUpdate(0);
    this.onSkillActive(this.character.name, this.character.skillName);

    audio.playSkill();
    this.triggerShake(10, 15);

    // Create a burst of skill particles
    for (let i = 0; i < 30; i++) {
      this.createParticle(
        this.player.x + this.player.width / 2,
        this.player.y + this.player.height / 2,
        this.character.color,
        Math.random() * 8 - 4,
        Math.random() * 8 - 4,
        Math.random() * 6 + 4
      );
    }

    // Apply specific character skill durations and effects
    switch (this.character.id) {
      case 'minji': // CD Shield
        this.player.hasShield = true;
        this.player.shieldHp = 2; // Can block 2 hits
        this.player.activeSkillTimer = 600; // ~10 seconds
        break;
      case 'hanni': // Hype Dash
        this.player.activeSkillTimer = 180; // ~3 seconds of fast invincible dash
        this.player.isInvincible = true;
        this.player.invincibleTimer = 180;
        break;
      case 'danielle': // Butterfly Score (Double multiplier + butterfly spawns)
        this.player.activeSkillTimer = 480; // ~8 seconds
        break;
      case 'haerin': // Magnet
        this.player.activeSkillTimer = 480; // ~8 seconds
        break;
      case 'hyein': // Slow motion (bullet time)
        this.player.activeSkillTimer = 360; // ~6 seconds
        this.timeScale = 0.3; // Obstacles and background slow down
        break;
    }
  }

  deactivateSkill() {
    this.player.isSkillActive = false;
    this.player.hasShield = false;
    this.timeScale = 1.0;
    if (this.character.id === 'hanni') {
      this.player.isInvincible = false;
    }
  }

  createParticle(x, y, color, vx, vy, size) {
    this.particles.push({
      x,
      y,
      color,
      vx,
      vy,
      size,
      alpha: 1.0,
      decay: Math.random() * 0.03 + 0.01
    });
  }

  loop(timestamp) {
    if (!this.isPlaying) return;

    const dt = (timestamp - this.lastTime) / 16.666; // Normalized delta time
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (this.player.attackTimer > 0) {
      this.player.attackTimer = Math.max(0, this.player.attackTimer - dt);
    }
    if (this.player.eatTimer > 0) {
      this.player.eatTimer = Math.max(0, this.player.eatTimer - dt);
    }
    if (this.player.hitAnimTimer > 0) {
      this.player.hitAnimTimer = Math.max(0, this.player.hitAnimTimer - dt);
    }
    this.distance += (this.player.isSkillActive && this.character.id === 'hanni' ? 12 : 4) * dt * this.timeScale;

    // 1. Shake & Bounce Handlers
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
    }
    // Dampen player eat bounce back to 1.0
    this.player.bounceScale += (1.0 - this.player.bounceScale) * 0.16 * dt;

    // 2. Active Skill Timer
    if (this.player.isSkillActive) {
      this.player.activeSkillTimer -= dt;
      if (this.player.activeSkillTimer <= 0) {
        this.deactivateSkill();
      }
    }

    // 3. Invincibility Timer
    if (this.player.invincibleTimer > 0) {
      this.player.invincibleTimer -= dt;
      if (this.player.invincibleTimer <= 0 && this.character.id !== 'hanni') {
        this.player.isInvincible = false;
      }
    }

    // 4. Update Player Movement
    if (this.controlMode === 'keyboard') {
      const accel = 1.2;
      const friction = 0.82;

      // Handle WASD & Arrows
      let ax = 0;
      let ay = 0;

      if (this.keys['ArrowUp'] || this.keys['KeyW']) ay = -accel;
      if (this.keys['ArrowDown'] || this.keys['KeyS']) ay = accel;
      if (this.keys['ArrowLeft'] || this.keys['KeyA']) ax = -accel;
      if (this.keys['ArrowRight'] || this.keys['KeyD']) ax = accel;

      this.player.vx = (this.player.vx + ax) * friction;
      this.player.vy = (this.player.vy + ay) * friction;

      this.player.x += this.player.vx * dt;
      this.player.y += this.player.vy * dt;
    } else {
      // Follow mouse/touch with easing
      const targetX = Math.max(20, Math.min(this.width / 2, this.mouse.x - this.player.width / 2));
      const targetY = Math.max(20, Math.min(this.height - this.player.height - 20, this.mouse.y - this.player.height / 2));

      this.player.x += (targetX - this.player.x) * 0.18 * dt;
      this.player.y += (targetY - this.player.y) * 0.18 * dt;
    }

    // Dynamic dash speed boost
    if (this.player.isSkillActive && this.character.id === 'hanni') {
      this.player.x = Math.max(150, this.player.x + (12 - this.player.x) * 0.05 * dt); // Push forward slightly during dash
    }

    // Bounds checking
    this.player.x = Math.max(20, Math.min(this.width / 2, this.player.x));
    this.player.y = Math.max(20, Math.min(this.height - this.player.height - 20, this.player.y));

    // Player Flight Trail Particles
    if (Math.random() < 0.4 * dt) {
      const trailColor = this.player.isSkillActive ? this.character.color : '#ffffff';
      this.createParticle(
        this.player.x,
        this.player.y + this.player.height / 2 + (Math.random() * 20 - 10),
        trailColor,
        -Math.random() * 3 - 2,
        Math.random() * 2 - 1,
        Math.random() * 4 + 2
      );
    }

    // 5. Update Backgrounds (Stars & Clouds)
    const baseScrollSpeed = (this.player.isSkillActive && this.character.id === 'hanni' ? 10 : 3.5);
    const speedMultiplier = baseScrollSpeed * this.timeScale * dt;

    this.bgStars.forEach(star => {
      star.x -= star.speed * speedMultiplier * 0.5;
      if (star.x < 0) {
        star.x = this.width;
        star.y = Math.random() * this.height;
      }
    });

    // Cloud background parallax layer
    if (Math.random() < 0.005 * dt) {
      this.bgClouds.push({
        x: this.width,
        y: Math.random() * (this.height - 100),
        w: Math.random() * 150 + 100,
        h: Math.random() * 60 + 40,
        speed: Math.random() * 0.5 + 0.3,
        opacity: Math.random() * 0.15 + 0.1
      });
    }

    this.bgClouds.forEach((cloud, idx) => {
      cloud.x -= cloud.speed * speedMultiplier;
      if (cloud.x + cloud.w < 0) {
        this.bgClouds.splice(idx, 1);
      }
    });

    // 6. Spawn Collectibles
    this.spawnTimers.collectible -= dt;
    if (this.spawnTimers.collectible <= 0) {
      const types = ['bunny', 'bunny', 'bunny', 'cd', 'binkybong'];
      const type = types[Math.floor(Math.random() * types.length)];
      this.collectibles.push({
        x: this.width + 50,
        y: Math.random() * (this.height - 100) + 50,
        type: type,
        size: type === 'bunny' ? 24 : type === 'cd' ? 32 : 36,
        color: type === 'bunny' ? '#ff79b4' : type === 'cd' ? '#06b6d4' : '#eab308'
      });
      // Dynamic spawn intervals
      this.spawnTimers.collectible = Math.random() * 80 + 50;
    }

    // 7. Spawn Obstacles
    this.spawnTimers.obstacle -= dt;
    if (this.spawnTimers.obstacle <= 0) {
      const obstacleTypes = ['cloud', 'glitch'];
      const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
      
      this.obstacles.push({
        x: this.width + 100,
        y: Math.random() * (this.height - 120) + 50,
        type: type,
        w: type === 'cloud' ? 70 : 35,
        h: type === 'cloud' ? 50 : 35,
        hp: type === 'cloud' ? 2 : 99999, // Glitch is indestructible!
        color: type === 'cloud' ? '#475569' : '#ef4444',
        vy: type === 'glitch' ? (Math.random() * 4 - 2) : 0 // Glitch pixels move vertically
      });
      // Increase spawn rate based on distance
      const minSpawnRate = Math.max(35, 100 - (this.distance / 200));
      this.spawnTimers.obstacle = Math.random() * 50 + minSpawnRate;
    }

    // 8. Update Projectiles
    this.projectiles.forEach((p, idx) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Create micro trail
      if (Math.random() < 0.3) {
        this.createParticle(p.x, p.y, p.color, -1, 0, 2);
      }

      if (p.x > this.width + p.radius) {
        this.projectiles.splice(idx, 1);
      }
    });

    // 9. Update Collectibles (Magnet effects apply here)
    // Haerin has passive magnetic pull. Active skill increases magnet range for others.
    let magnetRange = 120;
    if (this.player.isSkillActive && this.character.id === 'haerin') {
      magnetRange = 1000; // Screen-wide magnet
    } else if (this.character.id === 'haerin') {
      magnetRange = 250; // High passive range
    } else if (this.player.isSkillActive && this.character.id === 'danielle') {
      magnetRange = 350; // Danielle's skill increases range
    }

    this.collectibles.forEach((item, idx) => {
      // Move left
      let dx = item.x - (this.player.x + this.player.width / 2);
      let dy = item.y - (this.player.y + this.player.height / 2);
      let dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < magnetRange) {
        // Attracted by magnet
        let speed = (magnetRange === 1000 ? 15 : 8) * dt;
        item.x -= (dx / dist) * speed;
        item.y -= (dy / dist) * speed;
      } else {
        item.x -= (this.player.isSkillActive && this.character.id === 'hanni' ? 8 : 4.5) * dt * this.timeScale;
      }

      // Collide with player
      if (
        item.x - item.size / 2 < this.player.x + this.player.width &&
        item.x + item.size / 2 > this.player.x &&
        item.y - item.size / 2 < this.player.y + this.player.height &&
        item.y + item.size / 2 > this.player.y
      ) {
        this.collectItem(item);
        this.collectibles.splice(idx, 1);
        return;
      }

      if (item.x < -item.size) {
        this.collectibles.splice(idx, 1);
      }
    });

    // 10. Update Obstacles
    this.obstacles.forEach((obs, idx) => {
      // Scroll left
      const scrollSpeed = (this.player.isSkillActive && this.character.id === 'hanni' ? 8 : 4.8);
      obs.x -= scrollSpeed * dt * this.timeScale;
      obs.y += obs.vy * dt * this.timeScale;

      // Bounce glitch obstacles off screen limits
      if (obs.type === 'glitch') {
        if (obs.y < 30 || obs.y > this.height - obs.h - 30) {
          obs.vy *= -1;
        }
      }

      // Check collision with player
      if (
        obs.x < this.player.x + this.player.width - 10 &&
        obs.x + obs.w > this.player.x + 10 &&
        obs.y < this.player.y + this.player.height - 10 &&
        obs.y + obs.h > this.player.y + 10
      ) {
        if (this.player.isSkillActive && this.character.id === 'hanni') {
          // Hanni's hyper dash breaks through obstacles!
          this.destroyObstacle(obs, idx, true);
        } else {
          this.hitPlayer();
          this.obstacles.splice(idx, 1);
        }
        return;
      }

      // Check collision with player's projectiles
      this.projectiles.forEach((p, pIdx) => {
        if (
          p.x + p.radius > obs.x &&
          p.x - p.radius < obs.x + obs.w &&
          p.y + p.radius > obs.y &&
          p.y - p.radius < obs.y + obs.h
        ) {
          this.projectiles.splice(pIdx, 1);
          
          if (obs.type === 'cloud') {
            obs.hp -= 1;
            // Sparkles when hit
            for (let i = 0; i < 5; i++) {
              this.createParticle(p.x, p.y, p.color, Math.random() * 4 - 2, Math.random() * 4 - 2, 3);
            }
            if (obs.hp <= 0) {
              this.destroyObstacle(obs, idx, false);
            }
          }
        }
      });

      if (obs.x < -obs.w) {
        this.obstacles.splice(idx, 1);
      }
    });

    // 11. Update Particles
    this.particles.forEach((p, idx) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;

      if (p.alpha <= 0) {
        this.particles.splice(idx, 1);
      }
    });
  }

  collectItem(item) {
    audio.playCollect();

    // Trigger juicy squeeze animation
    this.player.bounceScale = 1.35;
    this.player.eatTimer = 15; // Show eating/cheering face for 15 frames (~250ms)

    let points = 100;
    let gaugeIncrease = 5;

    if (item.type === 'cd') {
      points = 300;
      gaugeIncrease = 12;
    } else if (item.type === 'binkybong') {
      points = 500;
      gaugeIncrease = 20;
      // Bonus: Heal player by 1 if not full
      if (this.player.hp < this.player.maxHp) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
      }
    }

    // Danielle's score multiplier (2x passive, 3x when skill is active)
    let multiplier = 1;
    if (this.character.id === 'danielle') {
      multiplier = this.player.isSkillActive ? 3 : 2;
    }

    this.score += points * multiplier;
    this.onScoreUpdate(this.score);

    // Increase skill gauge
    this.player.skillGauge = Math.min(100, this.player.skillGauge + gaugeIncrease);
    this.onSkillUpdate(this.player.skillGauge);

    // Score pop text animation / particles
    for (let i = 0; i < 8; i++) {
      this.createParticle(
        item.x,
        item.y,
        item.color,
        Math.random() * 4 - 2,
        Math.random() * 4 - 2,
        Math.random() * 4 + 2
      );
    }
  }

  destroyObstacle(obs, idx, isInstakill) {
    audio.playHit();
    this.triggerShake(4, 8);
    this.obstacles.splice(idx, 1);

    // Award minor points for destroying clouds
    const pts = isInstakill ? 200 : 100;
    this.score += pts * (this.character.id === 'danielle' && this.player.isSkillActive ? 3 : 1);
    this.onScoreUpdate(this.score);

    // Debris particles
    for (let i = 0; i < 15; i++) {
      this.createParticle(
        obs.x + obs.w / 2,
        obs.y + obs.h / 2,
        obs.color,
        Math.random() * 6 - 3,
        Math.random() * 6 - 3,
        Math.random() * 5 + 3
      );
    }
  }

  hitPlayer() {
    if (this.player.isInvincible) return;

    // CD Shield Skill Check (Minji)
    if (this.player.isSkillActive && this.character.id === 'minji' && this.player.hasShield) {
      this.player.shieldHp -= 1;
      audio.playHit();
      this.triggerShake(5, 10);
      
      // Flash player shields
      for (let i = 0; i < 15; i++) {
        this.createParticle(
          this.player.x + this.player.width / 2,
          this.player.y + this.player.height / 2,
          '#60a5fa',
          Math.random() * 5 - 2.5,
          Math.random() * 5 - 2.5,
          4
        );
      }

      if (this.player.shieldHp <= 0) {
        this.deactivateSkill();
      } else {
        // Temp i-frames to prevent insta-shred
        this.player.isInvincible = true;
        this.player.invincibleTimer = 45; // ~0.75s
      }
      return;
    }

    // Damage player
    this.player.hp -= 1;
    this.player.hitAnimTimer = 35; // Collision animation timer (approx 580ms)
    audio.playHit();
    this.triggerShake(12, 18);

    // Burst red particles on impact
    for (let i = 0; i < 20; i++) {
      this.createParticle(
        this.player.x + this.player.width / 2,
        this.player.y + this.player.height / 2,
        '#ef4444',
        Math.random() * 8 - 4,
        Math.random() * 8 - 4,
        Math.random() * 6 + 3
      );
    }

    if (this.player.hp <= 0) {
      this.isPlaying = false;
      this.onGameOver(this.score);
      audio.stopBgm();
    } else {
      // Temporary invincibility (1.5 seconds)
      this.player.isInvincible = true;
      this.player.invincibleTimer = 90;
    }
  }

  render() {
    this.ctx.save();
    
    // Apply Screen Shake
    if (this.shakeDuration > 0) {
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      this.ctx.translate(dx, dy);
    }

    // 1. Draw Space Background (Deep Navy/Purple Gradient)
    const bgGrad = this.ctx.createLinearGradient(0, 0, 0, this.height);
    bgGrad.addColorStop(0, '#090514');
    bgGrad.addColorStop(0.5, '#120b2e');
    bgGrad.addColorStop(1, '#1b1248');
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Apply slow-mo grid scanlines effect (Hyein's skill)
    if (this.timeScale < 1.0) {
      this.ctx.fillStyle = 'rgba(139, 92, 246, 0.08)'; // Purple slow-mo dimension tint
      this.ctx.fillRect(0, 0, this.width, this.height);
      
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      for (let y = 0; y < this.height; y += 4) {
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.width, y);
      }
      this.ctx.stroke();
    }

    // 2. Draw Stars
    this.ctx.fillStyle = '#ffffff';
    this.bgStars.forEach(star => {
      this.ctx.globalAlpha = star.speed * 1.5;
      this.ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    this.ctx.globalAlpha = 1.0;

    // 3. Draw Parallax Clouds
    this.bgClouds.forEach(cloud => {
      this.ctx.fillStyle = '#ffbfe7'; // Y2K pink cloud
      this.ctx.globalAlpha = cloud.opacity;
      
      this.ctx.beginPath();
      // Draw bubble clouds
      const cx = cloud.x;
      const cy = cloud.y;
      this.ctx.arc(cx, cy, cloud.h * 0.6, 0, Math.PI * 2);
      this.ctx.arc(cx + cloud.w * 0.35, cy - cloud.h * 0.2, cloud.h * 0.7, 0, Math.PI * 2);
      this.ctx.arc(cx + cloud.w * 0.7, cy, cloud.h * 0.5, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1.0;

    // Draw Y2K neon design grids / gridlines on the floor/ceiling
    this.ctx.strokeStyle = 'rgba(236, 72, 153, 0.15)'; // Pink neon grid
    this.ctx.lineWidth = 1;
    
    // Horizontal perspective grid lines at bottom
    const gridY = 480;
    this.ctx.beginPath();
    this.ctx.moveTo(0, gridY);
    this.ctx.lineTo(this.width, gridY);
    for (let i = -10; i <= 20; i++) {
      this.ctx.moveTo(this.width / 2, gridY - 80);
      this.ctx.lineTo(i * 80, this.height);
    }
    this.ctx.stroke();

    // 4. Draw Projectiles
    this.projectiles.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 12;
      this.ctx.fill();
      this.ctx.shadowBlur = 0; // reset
    });

    // 5. Draw Collectibles
    this.collectibles.forEach(item => {
      this.ctx.save();
      this.ctx.translate(item.x, item.y);

      // Add a rotating float effect
      const rotation = (performance.now() / 400) % (Math.PI * 2);
      this.ctx.rotate(rotation);

      if (item.type === 'bunny') {
        // Cute Y2K Bunny Outline / Drawing
        this.ctx.fillStyle = '#ff71ce';
        this.ctx.shadowColor = '#ff71ce';
        this.ctx.shadowBlur = 10;
        
        // Head
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
        this.ctx.fill();

        // Ears
        this.ctx.beginPath();
        this.ctx.ellipse(-5, -12, 4, 10, -Math.PI / 12, 0, Math.PI * 2);
        this.ctx.ellipse(5, -12, 4, 10, Math.PI / 12, 0, Math.PI * 2);
        this.ctx.fill();

        // Face details
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(-3, -2, 1.5, 0, Math.PI * 2);
        this.ctx.arc(3, -2, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (item.type === 'cd') {
        // Holographic Vinyl CD
        this.ctx.lineWidth = 4;
        
        // CD outer ring
        this.ctx.strokeStyle = '#05b6d4';
        this.ctx.shadowColor = '#05b6d4';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 14, 0, Math.PI * 2);
        this.ctx.stroke();

        // CD inner reflection
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 9, 0.2, Math.PI * 0.8);
        this.ctx.stroke();

        // CD Hole
        this.ctx.fillStyle = '#1e1b4b';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (item.type === 'binkybong') {
        // Golden Star Lightstick (Binky Bong)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#eab308';
        this.ctx.shadowColor = '#eab308';
        this.ctx.shadowBlur = 15;
        this.ctx.lineWidth = 2;

        // Stick
        this.ctx.fillRect(-2, 4, 4, 14);

        // Glass sphere
        this.ctx.beginPath();
        this.ctx.arc(0, -2, 9, 0, Math.PI * 2);
        this.ctx.stroke();

        // Star inside
        this.ctx.fillStyle = '#eab308';
        this.ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          this.ctx.lineTo(
            Math.cos(((18 + i * 72) * Math.PI) / 180) * 6,
            -2 - Math.sin(((18 + i * 72) * Math.PI) / 180) * 6
          );
          this.ctx.lineTo(
            Math.cos(((54 + i * 72) * Math.PI) / 180) * 3,
            -2 - Math.sin(((54 + i * 72) * Math.PI) / 180) * 3
          );
        }
        this.ctx.closePath();
        this.ctx.fill();
      }

      this.ctx.restore();
    });

    // 6. Draw Obstacles
    this.obstacles.forEach(obs => {
      this.ctx.save();
      this.ctx.translate(obs.x, obs.y);

      if (obs.type === 'cloud') {
        // Storm Cloud (Y2K Retro Dark Style)
        this.ctx.fillStyle = '#334155';
        this.ctx.strokeStyle = '#64748b';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = 'rgba(0,0,0,0.4)';
        this.ctx.shadowBlur = 5;

        // Draw multiple circles combined for a cloud
        this.ctx.beginPath();
        const r = obs.h * 0.5;
        this.ctx.arc(r, r, r, 0, Math.PI * 2);
        this.ctx.arc(obs.w * 0.5, r * 0.7, r * 1.1, 0, Math.PI * 2);
        this.ctx.arc(obs.w - r, r, r, 0, Math.PI * 2);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Storm lightning line underneath
        if (performance.now() % 500 < 100) {
          this.ctx.strokeStyle = '#facc15';
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.moveTo(obs.w / 2, obs.h);
          this.ctx.lineTo(obs.w / 2 - 10, obs.h + 12);
          this.ctx.lineTo(obs.w / 2 + 5, obs.h + 10);
          this.ctx.lineTo(obs.w / 2 - 5, obs.h + 22);
          this.ctx.stroke();
        }
      } else if (obs.type === 'glitch') {
        // Indestructible Cyber Glitch Pixels
        const size = obs.w;
        this.ctx.fillStyle = '#ef4444';
        this.ctx.shadowColor = '#ef4444';
        this.ctx.shadowBlur = 10;
        
        // Draw main red pixel box
        this.ctx.fillRect(0, 0, size, size);

        // Draw random digital artifact stripes
        this.ctx.fillStyle = '#06b6d4'; // Cyan artifact
        this.ctx.fillRect(-10, size / 3, 8, 3);
        this.ctx.fillRect(size + 2, (size * 2) / 3, 12, 4);

        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(2, 2, size - 4, size - 4);
      }

      this.ctx.restore();
    });

    // 7. Draw Particles
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      // Draw cute stars for particle explosion instead of plain circles
      if (Math.random() < 0.5) {
        // Draw standard circle
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        // Draw star particle
        const spikes = 4;
        const outerRad = p.size;
        const innerRad = p.size / 2;
        let rot = (Math.PI / 2) * 3;
        let x = p.x;
        let y = p.y;
        let step = Math.PI / spikes;

        this.ctx.beginPath();
        this.ctx.moveTo(p.x, p.y - outerRad);
        for (let i = 0; i < spikes; i++) {
          x = p.x + Math.cos(rot) * outerRad;
          y = p.y + Math.sin(rot) * outerRad;
          this.ctx.lineTo(x, y);
          rot += step;

          x = p.x + Math.cos(rot) * innerRad;
          y = p.y + Math.sin(rot) * innerRad;
          this.ctx.lineTo(x, y);
          rot += step;
        }
        this.ctx.lineTo(p.x, p.y - outerRad);
        this.ctx.closePath();
        this.ctx.fill();
      }
      this.ctx.restore();
    });
    this.ctx.globalAlpha = 1.0;

    // 8. Draw Player
    if (this.player.isInvincible && Math.floor(performance.now() / 100) % 2 === 0) {
      // Flashing effect for i-frames
    } else {
      this.ctx.save();
      
      // Floating wave animation when moving
      const bounce = Math.sin(performance.now() / 150) * 3;
      const angle = (this.controlMode === 'keyboard' ? this.player.vy * 0.03 : (this.mouse.y - this.player.y - 30) * 0.001);
      
      this.ctx.translate(this.player.x, this.player.y + bounce);
      
      // Rotate character in direction of flight, or tumble if hit
      this.ctx.translate(this.player.width / 2, this.player.height / 2);
      if (this.player.hitAnimTimer > 0) {
        // Backflip tumble effect
        const spin = (this.player.hitAnimTimer / 35) * Math.PI * 2;
        this.ctx.rotate(-spin);
      } else {
        this.ctx.rotate(Math.max(-0.25, Math.min(0.25, angle)));
      }
      
      // Squash & stretch depending on horizontal speed and eat bounce animations
      const stretchX = (this.player.isSkillActive && this.character.id === 'hanni' ? 1.15 : 1.0) * this.player.bounceScale;
      const stretchY = (this.player.isSkillActive && this.character.id === 'hanni' ? 0.85 : 1.0) * this.player.bounceScale;
      this.ctx.scale(stretchX, stretchY);

      // Draw glowing skill aura behind character if skill is active
      if (this.player.isSkillActive) {
        this.ctx.save();
        const glowGrad = this.ctx.createRadialGradient(0, 0, 10, 0, 0, this.player.width * 0.8);
        glowGrad.addColorStop(0, this.character.color);
        glowGrad.addColorStop(0.5, this.character.color + '33');
        glowGrad.addColorStop(1, 'transparent');
        this.ctx.fillStyle = glowGrad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, this.player.width * 0.8, 0, Math.PI * 2);
        this.ctx.fill();

        // Spinning magic star ring
        this.ctx.rotate((performance.now() / 250) % (Math.PI * 2));
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.5;
        this.ctx.globalAlpha = 0.5;
        this.ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          this.ctx.moveTo(0, -this.player.width * 0.6);
          this.ctx.lineTo(0, this.player.width * 0.6);
          this.ctx.rotate(Math.PI / 4);
        }
        this.ctx.stroke();
        this.ctx.restore();
      }
      
      // Draw actual custom cropped character canvas
      if (this.character && this.character.canvas) {
        let spriteCanvas = this.character.canvas;
        if (this.player.attackTimer > 0 && this.character.attackCanvas) {
          spriteCanvas = this.character.attackCanvas;
        } else if (this.player.eatTimer > 0 && this.character.cheerCanvas) {
          spriteCanvas = this.character.cheerCanvas;
        } else if (this.player.isSkillActive && this.character.cheerCanvas) {
          spriteCanvas = this.character.cheerCanvas;
        }

        // Dynamically compute width to preserve the active sprite's aspect ratio
        const currentRatio = spriteCanvas.width / spriteCanvas.height;
        const drawHeight = 65;
        const drawWidth = 65 * currentRatio;

        // Apply hit flashing red filter if in hit animation state
        if (this.player.hitAnimTimer > 0) {
          if (Math.floor(performance.now() / 50) % 2 === 0) {
            this.ctx.filter = 'sepia(1) saturate(8) hue-rotate(-50deg) brightness(0.8)';
          }
        }

        this.ctx.drawImage(
          spriteCanvas,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight
        );

        // Reset filter
        this.ctx.filter = 'none';

        // Draw dizzy stars above character's head if hit
        if (this.player.hitAnimTimer > 0) {
          this.ctx.save();
          this.ctx.translate(0, -drawHeight / 2 - 12);
          const time = performance.now() / 120;
          const numStars = 3;
          const rx = 24;
          const ry = 8;
          for (let i = 0; i < numStars; i++) {
            const starAngle = time + (i * Math.PI * 2 / numStars);
            const sx = Math.cos(starAngle) * rx;
            const sy = Math.sin(starAngle) * ry;
            this.ctx.save();
            this.ctx.translate(sx, sy);
            this.ctx.rotate(time * 0.5);
            this.ctx.fillStyle = '#facc15';
            this.ctx.shadowColor = '#facc15';
            this.ctx.shadowBlur = 6;
            this.ctx.beginPath();
            for (let j = 0; j < 5; j++) {
              this.ctx.lineTo(
                Math.cos(((18 + j * 72) * Math.PI) / 180) * 5,
                -Math.sin(((18 + j * 72) * Math.PI) / 180) * 5
              );
              this.ctx.lineTo(
                Math.cos(((54 + j * 72) * Math.PI) / 180) * 2,
                -Math.sin(((54 + j * 72) * Math.PI) / 180) * 2
              );
            }
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.restore();
          }
          this.ctx.restore();
        }
      } else {
        // Fallback: draw placeholder cube
        this.ctx.fillStyle = '#a855f7';
        this.ctx.fillRect(-25, -25, 50, 50);
      }
      
      this.ctx.restore();
    }

    // 9. Draw active character overlays (CD shield, speed dash flame, etc.)
    if (this.player.isSkillActive) {
      // Leader Shield Orbitals
      if (this.character.id === 'minji' && this.player.hasShield) {
        this.ctx.save();
        this.ctx.translate(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
        
        // Spin the shield
        const rotation = (performance.now() / 200) % (Math.PI * 2);
        this.ctx.rotate(rotation);
        
        // Drawing blue shield outline bubble
        this.ctx.strokeStyle = '#60a5fa';
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = '#3b82f6';
        this.ctx.shadowBlur = 12;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, this.player.width * 0.8, 0, Math.PI * 2);
        this.ctx.stroke();

        // Rotating CD orbit items
        for (let i = 0; i < this.player.shieldHp; i++) {
          const orbitAngle = (i * Math.PI);
          this.ctx.save();
          this.ctx.translate(Math.cos(orbitAngle) * this.player.width * 0.8, Math.sin(orbitAngle) * this.player.width * 0.8);
          this.ctx.rotate(rotation * 2);
          
          this.ctx.strokeStyle = '#60a5fa';
          this.ctx.fillStyle = '#ffffff';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();
          
          this.ctx.restore();
        }
        
        this.ctx.restore();
      }

      // Hype Dash Trails (Hanni)
      if (this.character.id === 'hanni') {
        // Draw cyan/pink fast shadow behind player
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        if (this.character.canvas) {
          this.ctx.shadowColor = '#06b6d4';
          this.ctx.shadowBlur = 15;
          this.ctx.drawImage(this.character.canvas, this.player.x - 30, this.player.y, this.player.width, this.player.height);
          this.ctx.shadowColor = '#ec4899';
          this.ctx.shadowBlur = 15;
          this.ctx.drawImage(this.character.canvas, this.player.x - 60, this.player.y, this.player.width, this.player.height);
        }
        this.ctx.restore();
      }

      // Danielle Butterfly spawns
      if (this.character.id === 'danielle' && Math.random() < 0.1) {
        // Summon golden helper butterfly sparkles
        this.createParticle(
          this.player.x + Math.random() * this.player.width,
          this.player.y + Math.random() * this.player.height,
          '#facc15',
          Math.random() * 4 + 2, // flies forward
          Math.random() * 4 - 2,
          5
        );
      }
    }

    // Restore Canvas State
    this.ctx.restore();
  }
}
