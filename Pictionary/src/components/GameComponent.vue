<template>
  <div id="pictionary-game">
    <div v-if="game && game.getShowInvite()" class="pict-invite">
      <p class="pict-invite__text">Invitation au Pictionary</p>
      <div class="pict-invite__actions">
        <button type="button" class="pict-invite__btn pict-invite__btn--accept" @click="inviteClicked(true)">
          Accepter
        </button>
        <button type="button" class="pict-invite__btn pict-invite__btn--decline" @click="inviteClicked(false)">
          Refuser
        </button>
      </div>
    </div>

    <template v-else-if="game && game.getShowGame()">
      <div class="pict-status" :class="statusClass">
        <span class="pict-status__text">{{ game.getGameMessage() }}</span>
      </div>

      <div class="pict-play">
        <div v-if="game.isDrawer()" class="pict-word">
          <template v-if="game.getGameOver() && game.getWord()">
            Mot : <strong>{{ game.getWord() }}</strong>
          </template>
          <template v-else>
            Mot à faire deviner : <strong>{{ game.getWord() }}</strong>
          </template>
        </div>
        <div v-else class="pict-word pict-word--hidden">
          <template v-if="game.getGameOver() && game.getWord()">
            Le mot était : <strong>{{ game.getWord() }}</strong>
          </template>
          <template v-else> Devine ce que {{ game.getDrawer() }} dessine. </template>
        </div>

        <div ref="canvasWrap" class="pict-canvas-wrap">
          <canvas
            ref="canvas"
            class="pict-canvas"
            :class="canvasCursorClass"
            @pointerdown.prevent="onPointerDown"
            @pointermove.prevent="onPointerMove"
            @pointerup.prevent="onPointerUp"
            @pointercancel.prevent="onPointerUp"
            @pointerleave="onPointerLeave"
          />
        </div>

        <div v-if="game.isDrawer() && !game.getGameOver()" class="pict-toolbar">
          <label class="pict-toolbar__label">
            <input v-model="fillMode" type="checkbox" />
            Seau (remplissage)
          </label>
          <label v-if="fillMode" class="pict-toolbar__label">
            Couleur remplissage
            <input v-model="fillColor" type="color" class="pict-toolbar__color" />
          </label>
          <label class="pict-toolbar__label">
            Couleur trait
            <input v-model="brushColor" type="color" class="pict-toolbar__color" />
          </label>
          <label class="pict-toolbar__label">
            Trait
            <input v-model.number="brushWidth" type="range" min="1" max="12" />
          </label>
          <button
            type="button"
            class="pict-toolbar__undo"
            :disabled="undoDisabled"
            title="Retire le dernier trait ou remplissage (répéter pour remonter l’historique)"
            @click="undoLastStroke"
          >
            Annuler dernier coup
          </button>
          <button type="button" class="pict-toolbar__clear" @click="clearBoard">Effacer</button>
        </div>

        <div v-if="game.isGuesser() && !game.getGameOver()" class="pict-guess">
          <input
            v-model="guessText"
            type="text"
            class="pict-guess__input"
            placeholder="Ton mot…"
            maxlength="64"
            @keyup.enter="submitGuess"
          />
          <button type="button" class="pict-guess__btn" @click="submitGuess">Envoyer</button>
          <p v-if="game.getLastGuessWrong()" class="pict-guess__hint">Ce n’est pas ça — réessaie.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
/* global kiwi:true */

import * as Utils from '../libs/Utils.js';
import { floodFillImageData, hexToRgb } from '../libs/canvasFloodFill.js';

const CANVAS_ASPECT = 520 / 320;

export default {
  data() {
    return {
      brushColor: '#1a1a1a',
      fillMode: false,
      fillColor: '#4488ff',
      brushWidth: 4,
      guessText: '',
      drawing: false,
      currentPoints: [],
      logicalW: 520,
      logicalH: 320,
      _capturePointerId: null,
      _lastCssW: null,
      _lastCssH: null,
      _lastDpr: null,
    };
  },
  computed: {
    game() {
      const buffer = kiwi.state.getActiveBuffer();
      return Utils.getGame(buffer.name);
    },
    statusClass() {
      if (!this.game) return '';
      if (this.game.getGameOver()) return 'pict-status--over';
      return 'pict-status--play';
    },
    undoDisabled() {
      if (!this.game || !this.game.isDrawer() || this.game.getGameOver()) return true;
      return this.game.getPaintOps().length === 0;
    },
    canvasCursorClass() {
      if (!this.game || !this.game.isDrawer() || this.game.getGameOver()) return {};
      if (this.fillMode) return { 'pict-canvas--fill': true };
      return { 'pict-canvas--draw': true };
    },
  },
  mounted() {
    this.listen(kiwi, 'plugin-pictionary.redraw-canvas', () => {
      this.$nextTick(() => this.redraw());
    });
    this._scheduleSetupCanvas = () => {
      if (this._setupCanvasRaf) {
        cancelAnimationFrame(this._setupCanvasRaf);
      }
      this._setupCanvasRaf = requestAnimationFrame(() => {
        this._setupCanvasRaf = null;
        this.setupCanvas();
      });
    };
    this.$nextTick(() => this.ensureCanvasObserver());
  },
  updated() {
    this.$nextTick(() => this.ensureCanvasObserver());
  },
  beforeDestroy() {
    if (this._setupCanvasRaf) {
      cancelAnimationFrame(this._setupCanvasRaf);
    }
    if (this._canvasResizeObserver) {
      this._canvasResizeObserver.disconnect();
      this._canvasResizeObserver = null;
    }
    if (this._windowResizeForCanvas) {
      window.removeEventListener('resize', this._scheduleSetupCanvas);
      this._windowResizeForCanvas = false;
    }
  },
  methods: {
    ensureCanvasObserver() {
      const wrap = this.$refs.canvasWrap;
      if (!wrap || !this.game || !this.game.getShowGame()) {
        if (this._canvasResizeObserver) {
          this._canvasResizeObserver.disconnect();
          this._canvasResizeObserver = null;
        }
        if (this._windowResizeForCanvas) {
          window.removeEventListener('resize', this._scheduleSetupCanvas);
          this._windowResizeForCanvas = false;
        }
        return;
      }
      if (!this._canvasResizeObserver && typeof ResizeObserver !== 'undefined') {
        this._canvasResizeObserver = new ResizeObserver(() => {
          this._scheduleSetupCanvas();
        });
        this._canvasResizeObserver.observe(wrap);
      } else if (!this._windowResizeForCanvas && typeof ResizeObserver === 'undefined') {
        this._windowResizeForCanvas = true;
        window.addEventListener('resize', this._scheduleSetupCanvas);
      }
      this._scheduleSetupCanvas();
    },
    setupCanvas() {
      const el = this.$refs.canvas;
      const wrap = this.$refs.canvasWrap;
      if (!el || !wrap) return;
      const dpr = window.devicePixelRatio || 1;
      const cssW = Math.max(1, Math.floor(wrap.clientWidth));
      const cssH = Math.max(1, Math.round(cssW / CANVAS_ASPECT));
      if (
        this._lastCssW === cssW &&
        this._lastCssH === cssH &&
        this._lastDpr === dpr
      ) {
        return;
      }
      this._lastCssW = cssW;
      this._lastCssH = cssH;
      this._lastDpr = dpr;
      this.logicalW = cssW;
      this.logicalH = cssH;
      el.style.width = `${cssW}px`;
      el.style.height = `${cssH}px`;
      el.width = Math.round(cssW * dpr);
      el.height = Math.round(cssH * dpr);
      this.redraw();
    },
    normPoint(clientX, clientY) {
      const el = this.$refs.canvas;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const w = this.logicalW;
      const h = this.logicalH;
      const x = ((clientX - r.left) / r.width) * w;
      const y = ((clientY - r.top) / r.height) * h;
      if (x < 0 || y < 0 || x > w || y > h) return null;
      return {
        x: Math.max(0, Math.min(1000, Math.round((x / w) * 1000))),
        y: Math.max(0, Math.min(1000, Math.round((y / h) * 1000))),
      };
    },
    redraw() {
      const el = this.$refs.canvas;
      if (!el || !this.game) return;
      const ctx = el.getContext('2d');
      const w = this.logicalW;
      const h = this.logicalH;
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, w, h);
      const ops = this.game.getPaintOps();
      ops.forEach((op) => {
        if (op.type === 'stroke') {
          if (!op.points || op.points.length < 2) return;
          ctx.strokeStyle = op.color || '#1a1a1a';
          ctx.lineWidth = op.width || 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          op.points.forEach((p, i) => {
            const px = (p.x / 1000) * w;
            const py = (p.y / 1000) * h;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
        } else if (op.type === 'fill') {
          const lx = (op.nx / 1000) * w;
          const ly = (op.ny / 1000) * h;
          this.applyFloodFillCommit(ctx, el, lx, ly, op.color);
        }
      });
    },
    applyFloodFillCommit(ctx, canvasEl, lx, ly, colorHex) {
      const dpr = window.devicePixelRatio || 1;
      const bw = canvasEl.width;
      const bh = canvasEl.height;
      const sx = Math.min(bw - 1, Math.max(0, Math.floor(lx * dpr)));
      const sy = Math.min(bh - 1, Math.max(0, Math.floor(ly * dpr)));
      const imageData = ctx.getImageData(0, 0, bw, bh);
      const { r, g, b } = hexToRgb(colorHex);
      if (!floodFillImageData(imageData, bw, bh, sx, sy, r, g, b)) return;
      ctx.putImageData(imageData, 0, 0);
    },
    tryCommitFill(p) {
      const el = this.$refs.canvas;
      if (!el || !this.game) return;
      const w = this.logicalW;
      const h = this.logicalH;
      const lx = (p.x / 1000) * w;
      const ly = (p.y / 1000) * h;
      this.redraw();
      const ctx = el.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const bw = el.width;
      const bh = el.height;
      const sx = Math.min(bw - 1, Math.max(0, Math.floor(lx * dpr)));
      const sy = Math.min(bh - 1, Math.max(0, Math.floor(ly * dpr)));
      const src = ctx.getImageData(0, 0, bw, bh);
      const trial = new ImageData(new Uint8ClampedArray(src.data), bw, bh);
      const rgb = hexToRgb(this.fillColor);
      if (!floodFillImageData(trial, bw, bh, sx, sy, rgb.r, rgb.g, rgb.b)) return;
      this.game.addPaintOp({ type: 'fill', nx: p.x, ny: p.y, color: this.fillColor });
      const buffer = kiwi.state.getActiveBuffer();
      Utils.sendData(buffer.getNetwork(), this.game.getRemotePlayer(), {
        cmd: 'fill',
        nx: p.x,
        ny: p.y,
        color: this.fillColor,
      });
      this.redraw();
    },
    releasePointerCaptureIfAny() {
      const el = this.$refs.canvas;
      if (
        el &&
        this._capturePointerId != null &&
        typeof el.releasePointerCapture === 'function'
      ) {
        try {
          el.releasePointerCapture(this._capturePointerId);
        } catch (_) {
          /* ignore */
        }
      }
      this._capturePointerId = null;
    },
    onPointerDown(e) {
      if (!this.game || !this.game.isDrawer() || this.game.getGameOver()) return;
      const el = this.$refs.canvas;
      const p = this.normPoint(e.clientX, e.clientY);
      if (!p) return;
      if (this.fillMode) {
        this.tryCommitFill(p);
        return;
      }
      this.drawing = true;
      this.currentPoints = [p];
      if (el && e.pointerId != null && typeof el.setPointerCapture === 'function') {
        try {
          el.setPointerCapture(e.pointerId);
          this._capturePointerId = e.pointerId;
        } catch (_) {
          this._capturePointerId = null;
        }
      }
    },
    onPointerMove(e) {
      if (!this.drawing || !this.game || !this.game.isDrawer()) return;
      const p = this.normPoint(e.clientX, e.clientY);
      if (!p) return;
      const last = this.currentPoints[this.currentPoints.length - 1];
      if (last && last.x === p.x && last.y === p.y) return;
      this.currentPoints.push(p);
      this.redrawPreview();
    },
    onPointerUp() {
      this.releasePointerCaptureIfAny();
      if (!this.drawing || !this.game || !this.game.isDrawer()) {
        this.drawing = false;
        this.currentPoints = [];
        return;
      }
      this.drawing = false;
      if (this.currentPoints.length >= 2) {
        const stroke = {
          points: this.currentPoints.slice(),
          color: this.brushColor,
          width: this.brushWidth,
        };
        this.game.addPaintOp({ type: 'stroke', ...stroke });
        const buffer = kiwi.state.getActiveBuffer();
        Utils.sendData(buffer.getNetwork(), this.game.getRemotePlayer(), {
          cmd: 'stroke',
          points: stroke.points,
          color: stroke.color,
          width: stroke.width,
        });
      }
      this.currentPoints = [];
      this.redraw();
    },
    onPointerLeave() {
      if (this._capturePointerId != null) {
        return;
      }
      if (this.drawing) {
        this.onPointerUp();
      }
    },
    redrawPreview() {
      const el = this.$refs.canvas;
      if (!el || !this.game) return;
      const ctx = el.getContext('2d');
      const w = this.logicalW;
      const h = this.logicalH;
      this.redraw();
      if (this.currentPoints.length < 2) return;
      ctx.strokeStyle = this.brushColor;
      ctx.lineWidth = this.brushWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      this.currentPoints.forEach((p, i) => {
        const px = (p.x / 1000) * w;
        const py = (p.y / 1000) * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    },
    clearBoard() {
      if (!this.game || !this.game.isDrawer() || this.game.getGameOver()) return;
      this.game.clearPaintOps();
      const buffer = kiwi.state.getActiveBuffer();
      Utils.sendData(buffer.getNetwork(), this.game.getRemotePlayer(), { cmd: 'clear' });
      this.redraw();
    },
    undoLastStroke() {
      if (!this.game || !this.game.isDrawer() || this.game.getGameOver()) return;
      if (this.game.getPaintOps().length === 0) return;
      this.game.popLastPaintOp();
      const buffer = kiwi.state.getActiveBuffer();
      Utils.sendData(buffer.getNetwork(), this.game.getRemotePlayer(), { cmd: 'undo' });
      kiwi.emit('plugin-pictionary.redraw-canvas');
    },
    submitGuess() {
      if (!this.game || !this.game.isGuesser() || this.game.getGameOver()) return;
      const text = (this.guessText || '').trim();
      if (!text) return;
      this.game.setLastGuessWrong(false);
      const buffer = kiwi.state.getActiveBuffer();
      Utils.sendData(buffer.getNetwork(), this.game.getRemotePlayer(), {
        cmd: 'guess',
        text,
      });
      this.guessText = '';
    },
    inviteClicked(accepted) {
      const network = kiwi.state.getActiveNetwork();
      const remotePlayer = kiwi.state.getActiveBuffer().name;
      const game = Utils.getGame(remotePlayer);
      game.setShowInvite(false);
      game.setInviteSent(false);
      if (accepted) {
        const drawer = Math.random() < 0.5 ? network.nick : remotePlayer;
        game.startGame(drawer);
        Utils.sendData(network, remotePlayer, { cmd: 'invite_accepted', drawer });
      } else {
        Utils.sendData(network, remotePlayer, { cmd: 'invite_declined' });
        kiwi.emit('mediaviewer.hide');
      }
    },
  },
};
</script>

<style scoped>
#pictionary-game {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  min-width: 0;
  padding: 12px 10px 18px;
  font-family: 'Source Sans Pro', Helvetica, sans-serif;
  max-width: 560px;
  margin: 0 auto;
  box-sizing: border-box;
}

.pict-invite {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: var(--brand-default-bg);
  border: 1px solid var(--comp-border, #b2b2b2);
  border-radius: 8px;
  width: 100%;
  box-sizing: border-box;
}

.pict-invite__text {
  color: var(--brand-default-fg);
  font-size: 1em;
  font-weight: 600;
  text-align: center;
}

.pict-invite__actions {
  display: flex;
  gap: 10px;
}

.pict-invite__btn {
  padding: 6px 18px;
  border-radius: 5px;
  font-size: 0.95em;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.pict-invite__btn--accept {
  background: var(--brand-primary, #42b992);
  color: #fff;
}

.pict-invite__btn--decline {
  background: var(--brand-error, #bf5155);
  color: #fff;
}

.pict-status {
  margin-bottom: 10px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.92em;
  font-weight: 600;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--comp-border, #b2b2b2);
  background: var(--brand-default-bg);
  color: var(--brand-default-fg);
}

.pict-status--play {
  border-color: var(--brand-primary, #42b992);
}

.pict-status--over {
  border-color: #e6a800;
}

.pict-play {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.pict-word {
  margin-bottom: 8px;
  font-size: 0.95em;
  color: var(--brand-default-fg);
  text-align: center;
}

.pict-word--hidden {
  font-style: italic;
  opacity: 0.9;
}

.pict-canvas-wrap {
  width: 100%;
  min-width: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--comp-border, #b2b2b2);
  background: #e8e8e8;
  line-height: 0;
}

.pict-canvas {
  display: block;
  touch-action: none;
}

.pict-canvas--draw {
  cursor: crosshair;
}

.pict-canvas--fill {
  cursor: pointer;
}

.pict-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  font-size: 0.85em;
  color: var(--brand-default-fg);
}

.pict-toolbar__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pict-toolbar__color {
  width: 36px;
  height: 28px;
  padding: 0;
  border: none;
  cursor: pointer;
}

.pict-toolbar__undo,
.pict-toolbar__clear {
  padding: 5px 12px;
  border-radius: 5px;
  border: 1px solid var(--comp-border, #b2b2b2);
  background: var(--brand-default-bg);
  color: var(--brand-default-fg);
  cursor: pointer;
  font-weight: 600;
}

.pict-toolbar__undo:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pict-guess {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.pict-guess__input {
  flex: 1;
  min-width: 140px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--comp-border, #b2b2b2);
  font-size: 0.95em;
}

.pict-guess__btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background: var(--brand-primary, #42b992);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.pict-guess__hint {
  width: 100%;
  margin: 0;
  font-size: 0.85em;
  color: var(--brand-error, #bf5155);
}
</style>
