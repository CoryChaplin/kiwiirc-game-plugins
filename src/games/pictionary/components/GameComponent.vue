<template>
  <div id="pictionary-game">
    <div v-if="game && game.getShowInvite()" class="pict-invite">
      <p class="pict-invite__text">
        <template v-if="game.isChannelGame()">
          {{ $t('kiwi-games:pict_invite_text_channel', { room: game.getTagTarget() }) }}
        </template>
        <template v-else>{{ $t('kiwi-games:pict_invite_text_pm') }}</template>
      </p>
      <div class="pict-invite__actions">
        <button type="button" class="pict-invite__btn pict-invite__btn--accept" @click="inviteClicked(true)">
          {{ $t('kiwi-games:common_accept') }}
        </button>
        <button type="button" class="pict-invite__btn pict-invite__btn--decline" @click="inviteClicked(false)">
          {{ $t('kiwi-games:common_decline') }}
        </button>
      </div>
    </div>

    <div v-else-if="game && game.getShowLobby()" class="pict-lobby">
      <p class="pict-lobby__title">{{ $t('kiwi-games:pict_lobby_title') }}</p>
      <p class="pict-lobby__host">{{ $t('kiwi-games:pict_lobby_host') }} <strong>{{ game.getLobbyHostNick() || '—' }}</strong></p>
      <p class="pict-lobby__players">
        {{ $t('kiwi-games:pict_lobby_players', { count: lobbyParticipantCount }) }} <strong>{{ lobbyParticipantsLabel }}</strong>
      </p>
      <div class="pict-lobby__actions">
        <button
          v-if="!game.isLocalParticipant() && !lobbyIsFull"
          type="button"
          class="pict-lobby__btn pict-lobby__btn--join"
          @click="lobbyJoin"
        >
          {{ $t('kiwi-games:pict_lobby_join') }}
        </button>
        <button
          v-if="game.canStartLobby()"
          type="button"
          class="pict-lobby__btn pict-lobby__btn--start"
          @click="lobbyStart"
        >
          {{ $t('kiwi-games:pict_lobby_start') }}
        </button>
      </div>
      <p class="pict-lobby__hint">{{ $t('kiwi-games:pict_lobby_hint') }}</p>
    </div>

    <template v-else-if="game && game.getShowGame()">
      <div class="pict-status" :class="statusClass">
        <span class="pict-status__text">{{ game.getGameMessage() }}</span>
      </div>

      <div class="pict-play">
        <div v-if="game.isDrawer()" class="pict-word">
          <template v-if="game.getGameOver() && game.getWord()">
            {{ $t('kiwi-games:pict_word_is') }} <strong>{{ game.getWord() }}</strong>
          </template>
          <template v-else-if="game.hasPendingDrawerWordChoice()">
            <p class="pict-word__pick-title">{{ $t('kiwi-games:pict_pick_word') }}</p>
            <div class="pict-word__choices">
              <button
                v-for="(w, idx) in game.getWordChoices()"
                :key="idx"
                type="button"
                class="pict-word__choice-btn"
                @click="chooseDrawerWord(w)"
              >
                {{ w }}
              </button>
            </div>
          </template>
          <template v-else>
            {{ $t('kiwi-games:pict_word_to_draw') }} <strong>{{ game.getWord() }}</strong>
          </template>
        </div>
        <div v-else class="pict-word pict-word--hidden">
          <template v-if="game.getGameOver() && game.getWord()">
            {{ $t('kiwi-games:pict_word_was') }} <strong>{{ game.getWord() }}</strong>
          </template>
          <template v-else-if="game.getTurnSolved()">{{ $t('kiwi-games:pict_turn_done') }}</template>
          <template v-else>{{ $t('kiwi-games:pict_guess_hint', { drawer: game.getDrawer() }) }}</template>
        </div>

        <div
          ref="canvasWrap"
          class="pict-canvas-wrap"
          :class="{
            'pict-canvas-wrap--frozen':
              (game.getTurnSolved() && !game.getGameOver() && !game.isDrawer()) ||
              game.hasPendingDrawerWordChoice(),
          }"
        >
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

        <div
          v-if="game.isDrawer() && !game.getGameOver() && !game.getTurnSolved() && !game.hasPendingDrawerWordChoice()"
          class="pict-toolbar"
        >
          <label class="pict-toolbar__label">
            <input v-model="fillMode" type="checkbox" />
            {{ $t('kiwi-games:pict_bucket') }}
          </label>
          <label v-if="fillMode" class="pict-toolbar__label">
            {{ $t('kiwi-games:pict_fill_color') }}
            <input v-model="fillColor" type="color" class="pict-toolbar__color" />
          </label>
          <label class="pict-toolbar__label">
            {{ $t('kiwi-games:pict_brush_color') }}
            <input v-model="brushColor" type="color" class="pict-toolbar__color" />
          </label>
          <label class="pict-toolbar__label">
            {{ $t('kiwi-games:pict_brush_width') }}
            <input v-model.number="brushWidth" type="range" min="1" max="12" />
          </label>
          <button
            type="button"
            class="pict-toolbar__undo"
            :disabled="undoDisabled"
            :title="$t('kiwi-games:pict_undo_title')"
            @click="undoLastStroke"
          >
            {{ $t('kiwi-games:pict_undo') }}
          </button>
          <button type="button" class="pict-toolbar__clear" @click="clearBoard">{{ $t('kiwi-games:pict_clear') }}</button>
        </div>
        <div v-else-if="game.isDrawer() && !game.getGameOver() && game.getTurnSolved()" class="pict-next">
          <button type="button" class="pict-next__btn" @click="nextTurn">{{ $t('kiwi-games:pict_next_turn_btn') }}</button>
        </div>

        <div
          v-if="game.getTurnSolved() && !game.getGameOver() && !game.isDrawer()"
          class="pict-round-solved"
        >
          <p class="pict-round-solved__badge">{{ $t('kiwi-games:pict_word_found_badge') }}</p>
          <p class="pict-round-solved__msg">{{ game.getGameMessage() }}</p>
          <p class="pict-round-solved__hint">{{ $t('kiwi-games:pict_guess_closed') }}</p>
        </div>

        <div v-if="game.isGuesser() && !game.getGameOver() && !game.getTurnSolved()" class="pict-guess">
          <input
            v-model="guessText"
            type="text"
            class="pict-guess__input"
            :placeholder="$t('kiwi-games:pict_guess_placeholder')"
            maxlength="64"
            @keyup.enter="submitGuess"
          />
          <button type="button" class="pict-guess__btn" @click="submitGuess">{{ $t('kiwi-games:pict_send') }}</button>
          <p v-if="game.getLastGuessWrong()" class="pict-guess__hint">{{ $t('kiwi-games:pict_wrong_guess') }}</p>
        </div>

        <div v-if="game.getGameOver() && scoreRows.length" class="pict-scoreboard">
          <p class="pict-scoreboard__title">{{ $t('kiwi-games:pict_final_scores') }}</p>
          <table class="pict-scoreboard__table">
            <thead>
              <tr>
                <th>{{ $t('kiwi-games:pict_player') }}</th>
                <th>{{ $t('kiwi-games:pict_score') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in scoreRows" :key="row.nick">
                <td>{{ row.nick }}</td>
                <td>{{ row.score }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="game.getGameOver() && canShowFeedbackForm" class="pict-feedback">
          <p class="pict-feedback__title">{{ $t('kiwi-games:pict_feedback_title') }}</p>
          <p class="pict-feedback__hint">{{ $t('kiwi-games:pict_feedback_hint') }}</p>
          <div class="pict-feedback__row">
            <label class="pict-feedback__label" for="pict-feedback-rating">{{ $t('kiwi-games:pict_feedback_rating') }}</label>
            <select id="pict-feedback-rating" v-model.number="feedbackRating" class="pict-feedback__select">
              <option v-for="n in 5" :key="`rate-${n}`" :value="n">{{ n }}</option>
            </select>
          </div>
          <label class="pict-feedback__label" for="pict-feedback-text">{{ $t('kiwi-games:pict_feedback_text') }}</label>
          <textarea
            id="pict-feedback-text"
            v-model="feedbackText"
            class="pict-feedback__textarea"
            maxlength="400"
            :placeholder="$t('kiwi-games:pict_feedback_placeholder')"
          />
          <div class="pict-feedback__actions">
            <button
              type="button"
              class="pict-feedback__send"
              :disabled="feedbackSending || feedbackSent"
              @click="submitFeedback"
            >
              {{ $t('kiwi-games:pict_feedback_send') }}
            </button>
            <span v-if="feedbackSent" class="pict-feedback__ok">{{ $t('kiwi-games:pict_feedback_sent') }}</span>
          </div>
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
      feedbackRating: 5,
      feedbackText: '',
      feedbackSending: false,
      feedbackSent: false,
      _lastFeedbackGameKey: null,
      _lastFeedbackGameOver: false,
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
      return Utils.getGameForBuffer(buffer);
    },
    lobbyParticipantCount() {
      if (!this.game) return 0;
      return this.game.getParticipants().length;
    },
    lobbyParticipantsLabel() {
      if (!this.game) return '';
      const p = this.game.getParticipants();
      return p.length ? p.join(', ') : '—';
    },
    lobbyIsFull() {
      if (!this.game || typeof this.game.constructor.MAX_PLAYERS !== 'number') return false;
      return this.lobbyParticipantCount >= this.game.constructor.MAX_PLAYERS;
    },
    statusClass() {
      if (!this.game) return '';
      if (this.game.getGameOver()) return 'pict-status--over';
      if (this.game.getTurnSolved()) return 'pict-status--solved';
      return 'pict-status--play';
    },
    undoDisabled() {
      if (!this.game || !this.game.isDrawer() || this.game.getGameOver()) return true;
      if (this.game.hasPendingDrawerWordChoice()) return true;
      return this.game.getPaintOps().length === 0;
    },
    canvasCursorClass() {
      if (!this.game || !this.game.isDrawer() || this.game.getGameOver() || this.game.hasPendingDrawerWordChoice()) {
        return {};
      }
      if (this.fillMode) return { 'pict-canvas--fill': true };
      return { 'pict-canvas--draw': true };
    },
    scoreRows() {
      if (!this.game || typeof this.game.getScoresByNick !== 'function') return [];
      const scores = this.game.getScoresByNick();
      const rows = Object.keys(scores).map((nick) => ({ nick, score: scores[nick] || 0 }));
      rows.sort((a, b) => b.score - a.score || a.nick.localeCompare(b.nick));
      return rows;
    },
    canShowFeedbackForm() {
      return !!(this.game && typeof this.game.getNetwork === 'function');
    },
  },
  mounted() {
    this.listen(kiwi, 'plugin-pictionary.update-button', () => {
      this.syncFeedbackState();
      this.$forceUpdate();
    });
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
    sanitizeFeedbackText(text) {
      const raw = typeof text === 'string' ? text : '';
      return raw.replace(/\s+/g, ' ').trim().slice(0, 400);
    },
    syncFeedbackState() {
      const game = this.game;
      if (!game) {
        this._lastFeedbackGameKey = null;
        this._lastFeedbackGameOver = false;
        this.feedbackSent = false;
        this.feedbackSending = false;
        this.feedbackText = '';
        this.feedbackRating = 5;
        return;
      }
      const gameKey = typeof game.getGameKey === 'function' ? game.getGameKey() : null;
      const gameOver = !!(typeof game.getGameOver === 'function' && game.getGameOver());
      if (gameKey !== this._lastFeedbackGameKey) {
        this.feedbackSent = false;
        this.feedbackSending = false;
        this.feedbackText = '';
        this.feedbackRating = 5;
      } else if (!gameOver && this._lastFeedbackGameOver) {
        this.feedbackSent = false;
        this.feedbackSending = false;
        this.feedbackText = '';
        this.feedbackRating = 5;
      }
      this._lastFeedbackGameKey = gameKey;
      this._lastFeedbackGameOver = gameOver;
    },
    submitFeedback() {
      if (!this.game || !this.game.getGameOver() || this.feedbackSending || this.feedbackSent) return;
      const buffer = kiwi.state.getActiveBuffer();
      if (!buffer) return;
      const network = buffer.getNetwork();
      if (!network || !network.ircClient || typeof network.ircClient.raw !== 'function') return;
      const rating = Math.max(1, Math.min(5, Math.floor(Number(this.feedbackRating) || 5)));
      const comment = this.sanitizeFeedbackText(this.feedbackText);
      this.feedbackSending = true;
      try {
        network.ircClient.raw(`PRIVMSG #beta :note ${rating}/5`);
        if (comment) {
          network.ircClient.raw(`PRIVMSG #beta :${comment}`);
        }
        this.feedbackSent = true;
      } catch (_) {
        /* silent fail */
      } finally {
        this.feedbackSending = false;
      }
    },
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
      if (!el || !this.game || this.game.hasPendingDrawerWordChoice()) return;
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
      Utils.sendData(buffer.getNetwork(), this.game.getTagTarget(), {
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
    chooseDrawerWord(word) {
      if (!this.game) return;
      this.game.chooseDrawerWord(word);
      kiwi.emit('plugin-pictionary.update-button');
    },
    onPointerDown(e) {
      if (!this.game || !this.game.isDrawer() || this.game.getGameOver() || this.game.hasPendingDrawerWordChoice()) {
        return;
      }
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
        Utils.sendData(buffer.getNetwork(), this.game.getTagTarget(), {
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
      if (!this.game || !this.game.isDrawer() || this.game.getGameOver() || this.game.hasPendingDrawerWordChoice()) {
        return;
      }
      this.game.clearPaintOps();
      const buffer = kiwi.state.getActiveBuffer();
      Utils.sendData(buffer.getNetwork(), this.game.getTagTarget(), { cmd: 'clear' });
      this.redraw();
    },
    undoLastStroke() {
      if (!this.game || !this.game.isDrawer() || this.game.getGameOver() || this.game.hasPendingDrawerWordChoice()) {
        return;
      }
      if (this.game.getPaintOps().length === 0) return;
      this.game.popLastPaintOp();
      const buffer = kiwi.state.getActiveBuffer();
      Utils.sendData(buffer.getNetwork(), this.game.getTagTarget(), { cmd: 'undo' });
      kiwi.emit('plugin-pictionary.redraw-canvas');
    },
    submitGuess() {
      if (!this.game || !this.game.isGuesser() || this.game.getGameOver() || this.game.getTurnSolved()) {
        return;
      }
      const text = (this.guessText || '').trim();
      if (!text) return;
      this.game.setLastGuessWrong(false);
      const buffer = kiwi.state.getActiveBuffer();
      Utils.sendData(buffer.getNetwork(), this.game.getTagTarget(), {
        cmd: 'guess',
        text,
      });
      this.guessText = '';
    },
    inviteClicked(accepted) {
      const network = kiwi.state.getActiveNetwork();
      const buffer = kiwi.state.getActiveBuffer();
      const game = Utils.getGameForBuffer(buffer);
      if (!game) return;
      game.setShowInvite(false);
      game.setInviteSent(false);
      if (game.isChannelGame()) {
        const roomName = game.getTagTarget();
        const hostNick = game.getLobbyHostNick();
        if (accepted) {
          try {
            if (network && network.ircClient && typeof network.ircClient.Message === 'function') {
              const joinMsg = new network.ircClient.Message('JOIN', roomName);
              joinMsg.prefix = network.nick;
              network.ircClient.raw(joinMsg);
            } else if (network && network.ircClient && typeof network.ircClient.raw === 'function') {
              network.ircClient.raw(`JOIN ${roomName}`);
            }
          } catch (_) {
            /* ignore join errors in mock/old runtimes */
          }
          game.setShowLobby(true);
          if (hostNick) {
            Utils.sendData(network, hostNick, {
              cmd: 'room_accept',
              room: roomName,
            });
          }
          Utils.sendData(network, roomName, { cmd: 'lobby_join', nick: network.nick });
          const roomBuffer = kiwi.state.getOrAddBufferByName(network.id, roomName);
          if (typeof kiwi.state.setActiveBufferByName === 'function') {
            kiwi.state.setActiveBufferByName(network.id, roomName);
          } else if (typeof kiwi.state.setActiveBuffer === 'function') {
            if (kiwi.state.setActiveBuffer.length >= 2) {
              kiwi.state.setActiveBuffer(network.id, roomName);
            } else {
              kiwi.state.setActiveBuffer(roomBuffer);
            }
          }
          kiwi.emit('plugin-pictionary.update-button');
        } else {
          Utils.removeGame(game.getGameKey());
          kiwi.emit('plugin-pictionary.update-button');
          kiwi.emit('mediaviewer.hide');
        }
        return;
      }

      const peer = buffer.name;
      if (accepted) {
        const drawer = Math.random() < 0.5 ? network.nick : peer;
        game.startGame(drawer);
        Utils.sendData(network, peer, { cmd: 'invite_accepted', drawer });
      } else {
        Utils.sendData(network, peer, { cmd: 'invite_declined' });
        kiwi.emit('mediaviewer.hide');
      }
    },
    lobbyJoin() {
      const buffer = kiwi.state.getActiveBuffer();
      const network = buffer.getNetwork();
      const game = Utils.getGameForBuffer(buffer);
      if (!game || !game.isChannelGame() || !game.getShowLobby()) return;
      const wasAdded = game.addParticipant(network.nick);
      if (!wasAdded) return;
      Utils.sendData(network, buffer.name, { cmd: 'lobby_join', nick: network.nick });
      kiwi.emit('plugin-pictionary.update-button');
    },
    lobbyStart() {
      const buffer = kiwi.state.getActiveBuffer();
      const network = buffer.getNetwork();
      const game = Utils.getGameForBuffer(buffer);
      if (!game || !game.canStartLobby()) return;
      const participants = game.getParticipants();
      const turnOrder = participants.slice();
      for (let i = turnOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = turnOrder[i];
        turnOrder[i] = turnOrder[j];
        turnOrder[j] = tmp;
      }
      const turnsPlayedByNick = {};
      const scoresByNick = {};
      turnOrder.forEach((nick) => {
        turnsPlayedByNick[nick] = 0;
        scoresByNick[nick] = 0;
      });
      const drawer = participants[Math.floor(Math.random() * participants.length)];
      const payload = {
        cmd: 'game_start',
        drawer,
        participants: participants.slice(),
        turnOrder,
        turnsPlayedByNick,
        scoresByNick,
        wordsUsedThisGame: [],
      };
      game.setParticipants(payload.participants);
      game.startGame(payload.drawer, payload.turnOrder, payload.turnsPlayedByNick, payload.scoresByNick);
      game.setInviteSent(false);
      kiwi.emit('plugin-kiwi-games.game-started', { game: 'pictionary' });
      kiwi.state.addMessage(buffer, {
        nick: '*',
        message: kiwi.i18n.t('kiwi-games:pict_game_start', { drawer }),
        type: 'message',
      });
      Utils.sendData(network, buffer.name, payload);
      kiwi.emit('plugin-pictionary.update-button');
    },
    nextTurn() {
      const buffer = kiwi.state.getActiveBuffer();
      const network = buffer.getNetwork();
      const game = Utils.getGameForBuffer(buffer);
      if (!game || !game.canGoNextTurn()) return;
      const payload = game.buildNextTurnPayload();
      if (!payload) return;
      game.applyNextTurnPayload(payload);
      if (payload.finished && game.getGameOver()) {
        kiwi.emit('plugin-kiwi-games.game-completed', { game: 'pictionary' });
      }
      if (game.getShowGame() && !game.getGameOver()) {
        kiwi.state.addMessage(buffer, {
          nick: '*',
          message: kiwi.i18n.t('kiwi-games:pict_next_turn_msg', { drawer: game.getDrawer() }),
          type: 'message',
        });
      }
      kiwi.emit('plugin-pictionary.redraw-canvas');
      kiwi.emit('plugin-pictionary.update-button');
      Utils.sendData(network, buffer.name, { cmd: 'next_turn', ...payload });
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

.pict-lobby {
  padding: 16px 14px;
  border-radius: 10px;
  border: 1px solid var(--comp-border, #b2b2b2);
  background: var(--brand-default-bg);
  color: var(--brand-default-fg);
  max-width: 100%;
  box-sizing: border-box;
}

.pict-lobby__title {
  margin: 0 0 10px;
  font-size: 1.05em;
  font-weight: 700;
}

.pict-lobby__host,
.pict-lobby__players {
  margin: 6px 0;
  font-size: 0.92em;
}

.pict-lobby__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 14px 0 10px;
}

.pict-lobby__btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 0.9em;
  font-weight: 600;
  cursor: pointer;
}

.pict-lobby__btn--join {
  background: var(--brand-primary, #42b992);
  color: #fff;
}

.pict-lobby__btn--start {
  background: #3a7ca5;
  color: #fff;
}

.pict-lobby__hint {
  margin: 0;
  font-size: 0.82em;
  opacity: 0.88;
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

.pict-status--solved {
  border-width: 2px;
  border-color: #1a7f4a;
  background: linear-gradient(180deg, #e8fff3 0%, #d4f5e4 100%);
  color: #0d3d24;
  font-size: 1em;
  padding: 12px 16px;
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

.pict-word__pick-title {
  margin: 0 0 10px;
  font-size: 0.95em;
  font-weight: 600;
}

.pict-word__choices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  align-items: stretch;
}

.pict-word__choice-btn {
  flex: 1 1 140px;
  max-width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--comp-border, #b2b2b2);
  background: var(--brand-default-bg);
  color: var(--brand-default-fg);
  font-size: 0.92em;
  font-weight: 600;
  cursor: pointer;
  line-height: 1.25;
}

.pict-word__choice-btn:hover {
  border-color: #4a90d9;
  background: rgba(74, 144, 217, 0.08);
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

.pict-canvas-wrap--frozen {
  position: relative;
  opacity: 0.88;
}

.pict-canvas-wrap--frozen::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.45);
  pointer-events: none;
}

.pict-round-solved {
  margin-top: 14px;
  padding: 16px 14px;
  border-radius: 10px;
  border: 2px solid #1a7f4a;
  background: linear-gradient(180deg, #f0fff7 0%, #d8f5e6 100%);
  text-align: center;
  box-sizing: border-box;
}

.pict-round-solved__badge {
  margin: 0 0 8px;
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.78em;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: #1a7f4a;
  color: #fff;
}

.pict-round-solved__msg {
  margin: 0 0 10px;
  font-size: 1.05em;
  font-weight: 700;
  color: #0d3d24;
  line-height: 1.35;
}

.pict-round-solved__hint {
  margin: 0;
  font-size: 0.88em;
  font-weight: 600;
  color: #1a5c38;
  opacity: 0.95;
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

.pict-next {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}

.pict-next__btn {
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  background: #3a7ca5;
  color: #fff;
  font-size: 0.92em;
  font-weight: 700;
  cursor: pointer;
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

.pict-scoreboard {
  margin-top: 14px;
  border: 1px solid var(--comp-border, #b2b2b2);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--brand-default-bg);
}

.pict-scoreboard__title {
  margin: 0 0 8px;
  font-size: 0.92em;
  font-weight: 700;
}

.pict-scoreboard__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}

.pict-scoreboard__table th,
.pict-scoreboard__table td {
  padding: 6px 4px;
  border-bottom: 1px solid var(--comp-border, #b2b2b2);
}

.pict-scoreboard__table th {
  text-align: left;
  font-weight: 700;
}

.pict-feedback {
  margin-top: 14px;
  border: 1px solid var(--comp-border, #b2b2b2);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--brand-default-bg);
}

.pict-feedback__title {
  margin: 0 0 6px;
  font-size: 0.95em;
  font-weight: 700;
}

.pict-feedback__hint {
  margin: 0 0 10px;
  font-size: 0.85em;
  opacity: 0.9;
}

.pict-feedback__row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.pict-feedback__label {
  display: block;
  font-size: 0.86em;
  margin-bottom: 4px;
}

.pict-feedback__select {
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid var(--comp-border, #b2b2b2);
  background: var(--brand-default-bg);
  color: var(--brand-default-fg);
}

.pict-feedback__textarea {
  width: 100%;
  min-height: 80px;
  resize: vertical;
  border-radius: 6px;
  border: 1px solid var(--comp-border, #b2b2b2);
  padding: 8px;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 0.9em;
  margin-bottom: 8px;
}

.pict-feedback__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pict-feedback__send {
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  background: var(--brand-primary, #42b992);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.pict-feedback__send:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.pict-feedback__ok {
  font-size: 0.85em;
  color: #1a7f4a;
  font-weight: 600;
}
</style>
