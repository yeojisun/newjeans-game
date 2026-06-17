<script setup>
import { ref, onMounted } from 'vue';
import { extractCharacters } from './extractor';
import { GameEngine } from './game';
import audio from './audio';

// Assets are imported directly inside extractor.js

// State variables
const isLoading = ref(true);
const errorMessage = ref('');
const characters = ref([]);
const selectedCharacter = ref(null);
const gameState = ref('menu'); // 'menu', 'playing', 'gameover'
const finalScore = ref(0);
const playerName = ref('');
const isSubmittingScore = ref(false);

// Leaderboard
const leaderboard = ref([]);
const leaderboardError = ref('');

// Live game HUD values
const currentScore = ref(0);
const skillGauge = ref(0);
const playerHp = ref(3);
const activeSkillMessage = ref('');
const skillMessageTimer = ref(null);
const isMuted = ref(false);

// Game Engine Reference
const canvasRef = ref(null);
let game = null;

// Yahoo animation trigger
const isYahooActive = ref(false);

const selectCharacter = (char) => {
  selectedCharacter.value = char;
  isYahooActive.value = true;
  audio.playYahoo();
  
  if (skillMessageTimer.value) clearTimeout(skillMessageTimer.value);
  
  setTimeout(() => {
    isYahooActive.value = false;
  }, 700);
};

onMounted(async () => {
  try {
    const extracted = await extractCharacters();
    characters.value = extracted;
    selectedCharacter.value = extracted[2]; // Default to Haerin (center kitty)
    isLoading.value = false;
    
    // Fetch initial leaderboard
    fetchLeaderboard();
  } catch (err) {
    errorMessage.value = err.message || '캐릭터 그림 파일 분석에 실패했습니다.';
    isLoading.value = false;
  }
});

// Fetch Leaderboard from Java Backend
const fetchLeaderboard = async () => {
  try {
    leaderboardError.value = '';
    const res = await fetch('https://newjeans-backend.onrender.com/api/scores');
    if (!res.ok) throw new Error();
    const data = await res.json();
    leaderboard.value = data;
  } catch (err) {
    console.warn('Java Server offline. Using fallback rankings.');
    leaderboardError.value = '서버가 오프라인 상태입니다.';
    // Fallback static rankings (empty since fixed entries are removed)
    leaderboard.value = [];
  }
};

// Start Game Loop
const startGame = () => {
  audio.resume();
  gameState.value = 'playing';
  currentScore.value = 0;
  skillGauge.value = 0;
  playerHp.value = 3;
  
  // Initialize game engine
  setTimeout(() => {
    if (canvasRef.value) {
      game = new GameEngine(canvasRef.value, selectedCharacter.value, {
        onScoreUpdate: (score) => {
          currentScore.value = score;
        },
        onGameOver: (score) => {
          finalScore.value = score;
          gameState.value = 'gameover';
          if (game) {
            game.stop();
          }
          fetchLeaderboard(); // refresh ranking database
        },
        onSkillUpdate: (gauge) => {
          skillGauge.value = gauge;
        },
        onSkillActive: (charName, skillName) => {
          showSkillBanner(charName, skillName);
        }
      });

      // Keep HP in sync
      const originalUpdate = game.update.bind(game);
      game.update = function(dt) {
        originalUpdate(dt);
        playerHp.value = game.player.hp;
      };

      game.start();
    }
  }, 100);
};

// Banner notifying player that a skill has been triggered
const showSkillBanner = (charName, skillName) => {
  if (skillMessageTimer.value) clearTimeout(skillMessageTimer.value);
  activeSkillMessage.value = `${charName} - ${skillName} 발동!`;
  
  skillMessageTimer.value = setTimeout(() => {
    activeSkillMessage.value = '';
  }, 3000);
};

// Submit Score to Java Backend
const submitScore = async () => {
  if (!playerName.value.trim()) return;
  isSubmittingScore.value = true;

  try {
    const response = await fetch('https://newjeans-backend.onrender.com/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: playerName.value.trim().toUpperCase(),
        score: finalScore.value,
        character: selectedCharacter.value.id
      })
    });

    if (response.ok) {
      const updatedList = await response.json();
      leaderboard.value = updatedList;
      playerName.value = '';
      gameState.value = 'menu'; // Go back to selection/leaderboard menu
    } else {
      alert('순위 저장에 실패했습니다.');
    }
  } catch (err) {
    alert('백엔드 서버와 통신할 수 없습니다. 서버가 켜져 있는지 확인해 주세요.');
  } finally {
    isSubmittingScore.value = false;
  }
};

const triggerSkill = () => {
  if (game && skillGauge.value >= 100) {
    game.activateSkill();
  }
};

const toggleMute = () => {
  isMuted.value = audio.toggleMute();
};
</script>

<template>
  <div class="app-container">
    <!-- Mute Button -->
    <button class="mute-btn" @click="toggleMute">
      <span v-if="isMuted">🔇 Sound Off</span>
      <span v-else>🔊 Sound On</span>
    </button>

    <!-- LOADING SCREEN -->
    <div v-if="isLoading" class="glass-panel text-center pulse-container">
      <h1 class="y2k-title glowing-text-cyan">ANALYZING DRAWING...</h1>
      <div class="loader-bar">
        <div class="loader-progress"></div>
      </div>
      <p class="mt-4 text-cyan">뉴진스 손그림 파일에서 캐릭터 5명을 추출하고 있습니다.</p>
    </div>

    <!-- ERROR SCREEN -->
    <div v-else-if="errorMessage" class="glass-panel text-center panel-error">
      <h1 class="y2k-title text-red">ANALYSIS ERROR</h1>
      <p class="text-white mt-4">{{ errorMessage }}</p>
      <p class="text-grey mt-2">그림 파일이 assets 폴더에 제대로 있는지 확인해 주세요.</p>
    </div>

    <!-- MAIN MENU & SELECTION SCREEN -->
    <div v-else-if="gameState === 'menu'" class="menu-layout">
      <!-- Title Header -->
      <header class="title-header text-center">
        <h1 class="retro-logo">NEWJEANS</h1>
        <h2 class="sub-logo glowing-text-pink">PPG SKY RUNNER</h2>
      </header>

      <div class="grid-container">
        <!-- Character Selector Panel -->
        <section class="glass-panel selection-panel">
          <h3 class="panel-title text-pink">SELECT YOUR CHARACTER</h3>
          
          <div class="character-avatars">
            <div 
              v-for="char in characters" 
              :key="char.id"
              class="avatar-card"
              :class="{ active: selectedCharacter?.id === char.id }"
              :style="{ '--char-color': char.color }"
              @click="selectCharacter(char)"
            >
              <div class="avatar-canvas-wrapper">
                <img :src="char.dataUrl" class="avatar-sprite-img" />
              </div>
              <span class="avatar-name">{{ char.name.split(' ')[0] }}</span>
            </div>
          </div>

          <!-- Character Stats / Detail Box -->
          <div v-if="selectedCharacter" class="stat-box" :style="{ borderColor: selectedCharacter.color }">
            <div class="stat-detail-grid">
              <div class="stat-info-pane">
                <div class="stat-header">
                  <span class="role-badge" :style="{ backgroundColor: selectedCharacter.color }">{{ selectedCharacter.role }}</span>
                  <h4 :style="{ color: selectedCharacter.color }">{{ selectedCharacter.name }}</h4>
                </div>
                
                <div class="skill-info">
                  <div class="skill-label">
                    <span class="icon-star">★</span> 
                    <strong>고유 스킬: {{ selectedCharacter.skillName }}</strong>
                  </div>
                  <p class="skill-description">{{ selectedCharacter.skillDesc }}</p>
                </div>
              </div>

              <!-- Large Character Preview Pane with Yahoo! overlay -->
              <div class="character-preview-pane">
                <transition name="bubble-pop">
                  <div v-if="isYahooActive" class="yahoo-bubble" :style="{ backgroundColor: selectedCharacter.color }">
                    야호! (YAHOO!)
                  </div>
                </transition>
                <img 
                  :src="isYahooActive ? selectedCharacter.cheerDataUrl : selectedCharacter.dataUrl" 
                  class="preview-sprite-img"
                  :class="{ yahoo: isYahooActive }"
                  :style="{ '--char-color': selectedCharacter.color }"
                />
              </div>
            </div>

            <button class="play-btn neon-pulse" :style="{ backgroundColor: selectedCharacter.color }" @click="startGame">
              GAME START ➔
            </button>
          </div>
        </section>

        <!-- Server Ranking Leaderboard Panel -->
        <section class="glass-panel leaderboard-panel">
          <div class="leaderboard-header">
            <h3 class="panel-title text-cyan">TOP 10 LEADERBOARD</h3>
            <button class="refresh-btn" @click="fetchLeaderboard">🔄 새로고침</button>
          </div>
          
          <div v-if="leaderboardError" class="error-badge">{{ leaderboardError }}</div>

          <div class="table-container">
            <div v-if="leaderboard.length === 0" class="no-rankings-box">
              <div><span class="star-deco">★</span> 등록된 랭킹 기록이 없습니다. <span class="star-deco">★</span></div>
              <p class="no-rankings-sub">첫 번째 명예의 전당 주인공이 되어보세요!</p>
            </div>
            <table v-else class="ranking-table">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>MEMBER</th>
                  <th>NAME</th>
                  <th>SCORE</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(score, index) in leaderboard" :key="index" :class="'rank-' + (index + 1)">
                  <td class="rank-num">
                    <span v-if="index === 0" class="crown">👑 1st</span>
                    <span v-else-if="index === 1" class="crown">🥈 2nd</span>
                    <span v-else-if="index === 2" class="crown">🥉 3rd</span>
                    <span v-else>{{ index + 1 }}th</span>
                  </td>
                  <td class="avatar-cell">
                    <span class="member-tag" :class="score.character.toLowerCase()">
                      {{ score.character.toUpperCase() }}
                    </span>
                  </td>
                  <td class="player-name">{{ score.name }}</td>
                  <td class="player-score text-pink">{{ score.score.toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>

    <!-- GAMEPLAY HUD AND CANVAS -->
    <div v-else-if="gameState === 'playing'" class="gameplay-container">
      <div class="hud-overlay">
        <!-- HP/Hearts -->
        <div class="hud-item hp-container">
          <span class="hud-label">HP:</span>
          <div class="hearts">
            <span v-for="i in 3" :key="i" class="heart" :class="{ empty: i > playerHp }">
              ❤️
            </span>
          </div>
        </div>

        <!-- Score -->
        <div class="hud-item score-container">
          <span class="hud-label">SCORE:</span>
          <span class="hud-val text-pink">{{ currentScore.toLocaleString() }}</span>
        </div>

        <!-- Skill Gauge -->
        <div class="hud-item skill-container">
          <span class="hud-label">SKILL:</span>
          <div class="gauge-bar" :class="{ ready: skillGauge >= 100 }" @click="triggerSkill">
            <div class="gauge-fill" :style="{ width: skillGauge + '%', backgroundColor: selectedCharacter.color }"></div>
            <div class="gauge-text">{{ skillGauge >= 100 ? 'SKILL READY [E / TAP]' : skillGauge + '%' }}</div>
          </div>
        </div>
      </div>

      <!-- Live Banner notifications for skill activations -->
      <transition name="banner-slide">
        <div v-if="activeSkillMessage" class="skill-banner" :style="{ backgroundColor: selectedCharacter.color }">
          {{ activeSkillMessage }}
        </div>
      </transition>

      <!-- Gameplay instruction hints -->
      <div class="instruction-hud">
        조작: 방향키/WASD 또는 마우스/터치 드래그 | 슈팅: 스페이스바/마우스 클릭
      </div>

      <!-- Canvas -->
      <div class="canvas-wrapper">
        <canvas ref="canvasRef"></canvas>
      </div>
    </div>

    <!-- GAME OVER SUBMIT SCREEN -->
    <div v-else-if="gameState === 'gameover'" class="glass-panel text-center gameover-panel">
      <h1 class="y2k-title glowing-text-pink bounce-anim">GAME OVER</h1>
      
      <div class="score-display">
        <p class="score-label">FINAL SCORE</p>
        <h2 class="score-value text-cyan">{{ finalScore.toLocaleString() }}</h2>
      </div>

      <div class="submit-form">
        <p class="submit-prompt">서버 랭킹에 기록을 등록하세요!</p>
        
        <div class="input-row">
          <input 
            v-model="playerName" 
            type="text" 
            placeholder="이름 입력 (MAX 10자)" 
            maxlength="10" 
            class="y2k-input"
            @keyup.enter="submitScore"
            :disabled="isSubmittingScore"
          />
          <button 
            class="submit-btn" 
            @click="submitScore" 
            :disabled="isSubmittingScore || !playerName.trim()"
          >
            {{ isSubmittingScore ? '등록 중...' : '등록 ➔' }}
          </button>
        </div>
        
        <button class="cancel-btn" @click="gameState = 'menu'">
          등록 안하고 메인 메뉴로
        </button>
      </div>
    </div>
  </div>
</template>

<style>
/* CSS Design System - Y2K Cyber Bubblegum Pop */

:root {
  --neon-pink: #ff71ce;
  --neon-blue: #01cdfe;
  --neon-cyan: #05b6d4;
  --neon-green: #05ffc0;
  --neon-purple: #b967ff;
  --dark-indigo: #0b071a;
  --panel-bg: rgba(18, 11, 41, 0.65);
}

* {
  box-sizing: border-box;
}

body {
  background-color: var(--dark-indigo);
  color: #ffffff;
  font-family: 'Outfit', sans-serif;
  user-select: none;
}

/* Animations */
@keyframes neonPulse {
  0%, 100% { box-shadow: 0 0 10px var(--char-color, var(--neon-pink)), 0 0 20px rgba(0,0,0,0.5); }
  50% { box-shadow: 0 0 22px var(--char-color, var(--neon-pink)), 0 0 5px var(--char-color, var(--neon-pink)); }
}

@keyframes bannerAnim {
  0% { transform: translate(-50%, -20px) scale(0.9); opacity: 0; }
  10% { transform: translate(-50%, 0) scale(1); opacity: 1; }
  90% { transform: translate(-50%, 0) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -20px) scale(0.9); opacity: 0; }
}

@keyframes pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; filter: brightness(1.2); }
}

/* Text Colors */
.text-pink { color: var(--neon-pink); }
.text-cyan { color: var(--neon-blue); }
.text-green { color: var(--neon-green); }
.text-purple { color: var(--neon-purple); }
.text-red { color: #ff4d4d; }

.glowing-text-pink {
  text-shadow: 0 0 8px var(--neon-pink), 0 0 15px rgba(255,113,206,0.5);
}
.glowing-text-cyan {
  text-shadow: 0 0 8px var(--neon-blue), 0 0 15px rgba(1,205,254,0.5);
}

/* Glassmorphism Panel */
.glass-panel {
  background: var(--panel-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 2px solid rgba(255, 113, 206, 0.25);
  border-radius: 20px;
  padding: 30px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

.app-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  padding: 20px;
  background: radial-gradient(circle at center, #180d38 0%, #080512 100%);
}

.mute-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  padding: 8px 12px;
  border-radius: 30px;
  cursor: pointer;
  z-index: 100;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s ease;
}
.mute-btn:hover {
  background: rgba(255,255,255,0.2);
  transform: scale(1.05);
}

/* LOADING SCREEN */
.pulse-container {
  animation: pulse 2s infinite ease-in-out;
  max-width: 480px;
  width: 100%;
}
.y2k-title {
  font-family: 'Rubik Mono One', sans-serif;
  font-size: 1.8rem;
  letter-spacing: 2px;
  margin-bottom: 20px;
}
.loader-bar {
  width: 100%;
  height: 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid rgba(1, 205, 254, 0.3);
}
.loader-progress {
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, var(--neon-blue), var(--neon-pink));
  border-radius: 5px;
  animation: loadingAnim 1.8s infinite ease-in-out;
}
@keyframes loadingAnim {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

/* MENU LAYOUT */
.menu-layout {
  display: flex;
  flex-direction: column;
  max-width: 1100px;
  width: 100%;
  height: 100%;
  justify-content: center;
  gap: 20px;
}
.title-header {
  margin-bottom: 5px;
}
.retro-logo {
  font-family: 'Rubik Mono One', sans-serif;
  font-size: 3.5rem;
  margin: 0;
  line-height: 1.0;
  letter-spacing: -2px;
  background: linear-gradient(180deg, #ffffff 30%, #e8e8e8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 10px rgba(255,255,255,0.2));
}
.sub-logo {
  font-family: 'Outfit', sans-serif;
  font-weight: 800;
  font-size: 1.4rem;
  margin: 5px 0 0 0;
  letter-spacing: 5px;
}

.grid-container {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 25px;
  height: 70%;
  min-height: 480px;
}

.selection-panel {
  border-color: rgba(255, 113, 206, 0.4);
  display: flex;
  flex-direction: column;
}
.panel-title {
  font-family: 'Rubik Mono One', sans-serif;
  font-size: 1.1rem;
  margin: 0 0 20px 0;
  letter-spacing: 1px;
}

.character-avatars {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.avatar-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 10px 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.avatar-card:hover {
  transform: translateY(-5px);
  background: rgba(255,255,255,0.08);
}
.avatar-card.active {
  background: rgba(255, 255, 255, 0.12);
  border-color: var(--char-color);
  box-shadow: 0 0 12px var(--char-color);
}
.avatar-canvas-wrapper {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-sprite-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
}
.avatar-name {
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 6px;
  color: #d1d5db;
}
.avatar-card.active .avatar-name {
  color: #fff;
  font-weight: 800;
}

.stat-box {
  border: 2px solid;
  border-radius: 16px;
  padding: 20px;
  background: rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

/* Character Selection Layout Extensions */
.stat-detail-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 15px;
  flex-grow: 1;
}

.stat-info-pane {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.character-preview-pane {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
}

.preview-sprite-img {
  height: 110px;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 4px 10px var(--char-color, rgba(255, 255, 255, 0.3)));
  transition: transform 0.2s ease;
}

.yahoo-bubble {
  position: absolute;
  top: -20px;
  right: -5px;
  color: #000;
  font-family: 'Rubik Mono One', sans-serif;
  font-size: 0.55rem;
  padding: 5px 8px;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(255,255,255,0.4);
  border: 1.5px solid #fff;
  z-index: 5;
  font-weight: bold;
}

.yahoo-bubble::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 20px;
  border-width: 6px 6px 0;
  border-style: solid;
  border-color: inherit;
  display: block;
  width: 0;
}

@keyframes yahooBounce {
  0% { transform: scale(1) translateY(0) rotate(0deg); }
  15% { transform: scale(0.85, 1.15) translateY(0) rotate(0deg); }
  40% { transform: scale(1.2, 0.8) translateY(-40px) rotate(12deg); }
  60% { transform: scale(0.9, 1.1) translateY(-15px) rotate(-6deg); }
  80% { transform: scale(1.08, 0.92) translateY(0) rotate(3deg); }
  100% { transform: scale(1) translateY(0) rotate(0deg); }
}

.preview-sprite-img.yahoo {
  animation: yahooBounce 0.7s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
}

/* Bubble pop-up animation */
.bubble-pop-enter-active {
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.bubble-pop-leave-active {
  animation: popOut 0.2s cubic-bezier(0.6, -0.28, 0.735, 0.045);
}
@keyframes popIn {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes popOut {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0); opacity: 0; }
}
.stat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.stat-header h4 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
}
.role-badge {
  color: #000;
  font-weight: 800;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}
.skill-info {
  flex-grow: 1;
}
.skill-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.95rem;
  margin-bottom: 6px;
}
.icon-star {
  color: var(--neon-pink);
}
.skill-description {
  font-size: 0.85rem;
  color: #9ca3af;
  line-height: 1.4;
  margin: 0;
}

.play-btn {
  border: none;
  color: #000;
  font-weight: 900;
  font-size: 1.1rem;
  font-family: 'Rubik Mono One', sans-serif;
  letter-spacing: 1px;
  padding: 14px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 15px;
}
.play-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-2px);
}
.neon-pulse {
  animation: neonPulse 2s infinite;
}

/* LEADERBOARD PANEL */
.leaderboard-panel {
  border-color: rgba(1, 205, 254, 0.4);
  display: flex;
  flex-direction: column;
}
.leaderboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.leaderboard-header .panel-title {
  margin: 0;
}
.refresh-btn {
  background: transparent;
  border: 1px solid var(--neon-cyan);
  color: var(--neon-cyan);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}
.refresh-btn:hover {
  background: rgba(1, 205, 254, 0.1);
}
.error-badge {
  background: rgba(239, 68, 68, 0.15);
  border: 1px dashed rgba(239, 68, 68, 0.5);
  color: #fca5a5;
  font-size: 0.75rem;
  padding: 6px 12px;
  border-radius: 8px;
  margin-bottom: 10px;
}
.table-container {
  overflow-y: auto;
  flex-grow: 1;
}
.ranking-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.ranking-table th {
  font-size: 0.75rem;
  font-weight: 800;
  color: #6b7280;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.ranking-table td {
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: 0.9rem;
}
.rank-num {
  font-weight: 800;
  font-size: 0.85rem;
}
.crown {
  font-family: 'Rubik Mono One', sans-serif;
  font-size: 0.75rem;
}
.rank-1 .crown { color: var(--neon-pink); }
.rank-2 .crown { color: var(--neon-blue); }
.rank-3 .crown { color: var(--neon-green); }

.avatar-cell {
  padding-right: 10px;
}
.member-tag {
  font-size: 0.65rem;
  font-weight: 800;
  color: #000;
  padding: 1px 6px;
  border-radius: 4px;
}
.member-tag.hanni { background-color: #ff4d8d; }
.member-tag.danielle { background-color: #ffb300; }
.member-tag.haerin { background-color: #10b981; }
.member-tag.minji { background-color: #3b82f6; }
.member-tag.hyein { background-color: #8b5cf6; }

.player-name {
  font-weight: 600;
}
.player-score {
  font-weight: 800;
  font-family: 'Rubik Mono One', sans-serif;
  font-size: 0.8rem;
  text-align: right;
}

/* GAMEPLAY HUDS */
.gameplay-container {
  position: relative;
  width: 100%;
  max-width: 960px;
  aspect-ratio: 16 / 9;
  background-color: #020205;
  border: 4px solid var(--neon-pink);
  border-radius: 20px;
  box-shadow: 0 0 25px rgba(255, 113, 206, 0.4);
  overflow: hidden;
}
.hud-overlay {
  position: absolute;
  top: 15px;
  left: 15px;
  right: 15px;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
  z-index: 10;
}
.hud-item {
  background: rgba(0,0,0,0.65);
  border: 1px solid rgba(255,255,255,0.15);
  padding: 6px 14px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Rubik Mono One', sans-serif;
  font-size: 0.85rem;
}
.hud-label {
  color: #9ca3af;
}
.hearts {
  display: flex;
  gap: 4px;
  font-size: 1.1rem;
}
.heart.empty {
  filter: grayscale(1) opacity(0.3);
}

.gauge-bar {
  pointer-events: auto; /* Allow clicking the gauge bar to activate skill */
  position: relative;
  width: 160px;
  height: 22px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
}
.gauge-bar.ready {
  border-color: #fff;
  box-shadow: 0 0 10px #fff;
  animation: pulse 1s infinite alternate;
}
.gauge-fill {
  height: 100%;
  transition: width 0.15s ease-out;
}
.gauge-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.55rem;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  white-space: nowrap;
}

.skill-banner {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  color: #000;
  font-family: 'Rubik Mono One', sans-serif;
  font-size: 1.2rem;
  padding: 8px 30px;
  border-radius: 30px;
  box-shadow: 0 0 20px #fff;
  animation: bannerAnim 3s forwards;
  z-index: 10;
}

.instruction-hud {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255,255,255,0.5);
  font-size: 0.75rem;
  background: rgba(0,0,0,0.5);
  padding: 4px 15px;
  border-radius: 12px;
  pointer-events: none;
  z-index: 10;
}

.canvas-wrapper {
  width: 100%;
  height: 100%;
}
.canvas-wrapper canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* GAMEOVER PANEL */
.gameover-panel {
  max-width: 460px;
  width: 100%;
  border-color: var(--neon-pink);
  animation: pulse 4s infinite alternate;
}
.bounce-anim {
  font-size: 2.5rem;
  color: var(--neon-pink);
  margin-top: 0;
}
.score-display {
  background: rgba(0,0,0,0.3);
  padding: 15px;
  border-radius: 12px;
  margin-bottom: 25px;
  border: 1px solid rgba(255,255,255,0.06);
}
.score-label {
  font-size: 0.8rem;
  color: #9ca3af;
  font-weight: 800;
  letter-spacing: 2px;
  margin: 0 0 5px 0;
}
.score-value {
  font-family: 'Rubik Mono One', sans-serif;
  font-size: 2.2rem;
  margin: 0;
}
.submit-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.submit-prompt {
  font-size: 0.9rem;
  margin: 0;
  color: #e5e7eb;
}
.input-row {
  display: flex;
  gap: 10px;
}
.y2k-input {
  flex-grow: 1;
  background: rgba(0, 0, 0, 0.4);
  border: 2px solid rgba(255, 113, 206, 0.3);
  padding: 12px;
  border-radius: 10px;
  color: #fff;
  font-family: 'Outfit', sans-serif;
  font-weight: 600;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s;
}
.y2k-input:focus {
  border-color: var(--neon-cyan);
  box-shadow: 0 0 8px rgba(1, 205, 254, 0.3);
}
.submit-btn {
  background: var(--neon-cyan);
  color: #000;
  border: none;
  font-weight: 800;
  padding: 0 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.submit-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.cancel-btn {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.15);
  color: #9ca3af;
  padding: 8px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}
.cancel-btn:hover {
  background: rgba(255,255,255,0.05);
  color: #fff;
}

.no-rankings-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 10px;
  text-align: center;
  color: #6b7280;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.15);
  margin-top: 10px;
}
.no-rankings-sub {
  font-size: 0.75rem;
  color: #9ca3af;
  margin: 8px 0 0 0;
  font-weight: 500;
}
.star-deco {
  color: var(--neon-pink);
  margin: 0 4px;
}

/* Mobile Responsive Design */
@media (max-width: 768px) {
  .app-container {
    height: auto;
    min-height: 100vh;
    overflow-y: auto;
    padding: 10px;
    align-items: flex-start;
  }
  
  .menu-layout {
    height: auto;
    padding: 10px 0;
  }
  
  .retro-logo {
    font-size: 2.2rem;
  }
  
  .sub-logo {
    font-size: 0.95rem;
    letter-spacing: 3px;
  }
  
  .grid-container {
    grid-template-columns: 1fr;
    height: auto;
    min-height: auto;
    gap: 15px;
  }
  
  .character-avatars {
    grid-template-columns: repeat(5, 1fr);
    gap: 5px;
  }
  
  .avatar-card {
    padding: 8px 3px;
  }
  
  .avatar-canvas-wrapper {
    width: 45px;
    height: 45px;
  }
  
  .stat-detail-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  
  .character-preview-pane {
    height: 100px;
    order: -1;
  }
  
  .preview-sprite-img {
    height: 90px;
  }
  
  .leaderboard-panel {
    margin-top: 10px;
  }
  
  .gameplay-container {
    border-radius: 12px;
    border-width: 3px;
  }
  
  .hud-overlay {
    top: 8px;
    left: 8px;
    right: 8px;
    gap: 5px;
  }
  
  .hud-item {
    padding: 4px 8px;
    font-size: 0.65rem;
    border-radius: 8px;
  }
  
  .hearts {
    font-size: 0.85rem;
  }
  
  .gauge-bar {
    width: 100px;
    height: 18px;
  }
  
  .gauge-text {
    font-size: 0.45rem;
  }
  
  .instruction-hud {
    font-size: 0.6rem;
    padding: 2px 10px;
    bottom: 5px;
  }
  
  .skill-banner {
    font-size: 0.85rem;
    padding: 4px 15px;
    top: 45px;
  }
}

/* Landscape orientation for vertical/portrait held devices inside gameplay context */
@media (max-width: 768px) and (orientation: portrait) {
  .gameplay-container {
    position: fixed;
    top: 50%;
    left: 50%;
    width: 100vh !important;
    height: 100vw !important;
    transform: translate(-50%, -50%) rotate(90deg);
    transform-origin: center;
    z-index: 9999;
    border-radius: 0;
    border: none;
    box-shadow: none;
  }
}

@media (max-width: 480px) {
  .retro-logo {
    font-size: 1.8rem;
  }
  
  .sub-logo {
    font-size: 0.8rem;
  }
  
  .panel-title {
    font-size: 0.95rem;
    margin-bottom: 12px;
  }
  
  .avatar-name {
    font-size: 0.65rem;
  }
}
</style>
