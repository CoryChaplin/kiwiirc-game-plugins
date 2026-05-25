<template>
    <div v-if="show" class="game-feedback">
        <p class="game-feedback__title">{{ $t('kiwi-games:common_feedback_title') }}</p>
        <p class="game-feedback__hint">{{ $t('kiwi-games:common_feedback_hint') }}</p>
        <div class="game-feedback__row">
            <label class="game-feedback__label" :for="ratingId">{{ $t('kiwi-games:common_feedback_rating') }}</label>
            <select :id="ratingId" v-model.number="rating" class="game-feedback__select">
                <option v-for="n in 5" :key="`${idPrefix}-rate-${n}`" :value="n">{{ n }}</option>
            </select>
        </div>
        <label class="game-feedback__label" :for="textId">{{ $t('kiwi-games:common_feedback_text') }}</label>
        <textarea
            :id="textId"
            v-model="comment"
            class="game-feedback__textarea"
            maxlength="400"
            :placeholder="$t('kiwi-games:common_feedback_placeholder')"
        />
        <div class="game-feedback__actions">
            <button
                type="button"
                class="game-feedback__send"
                :disabled="sending || sent"
                @click="submit"
            >
                {{ $t('kiwi-games:common_feedback_send') }}
            </button>
            <span v-if="sent" class="game-feedback__ok">{{ $t('kiwi-games:common_feedback_sent') }}</span>
        </div>
    </div>
</template>

<script>
/* global kiwi:true */

import { submitGameFeedback } from '../feedback.js';

export default {
    props: {
        show: {
            type: Boolean,
            default: false,
        },
        gameLabel: {
            type: String,
            required: true,
        },
        resetKey: {
            type: [String, Number],
            default: '',
        },
        feedbackChannel: {
            type: String,
            default: '#beta',
        },
    },
    data() {
        return {
            rating: 5,
            comment: '',
            sending: false,
            sent: false,
            _lastResetKey: null,
            _lastShow: false,
        };
    },
    computed: {
        idPrefix() {
            return String(this.gameLabel || 'game')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '') || 'game';
        },
        ratingId() {
            return `${this.idPrefix}-feedback-rating`;
        },
        textId() {
            return `${this.idPrefix}-feedback-text`;
        },
    },
    watch: {
        resetKey: 'syncFormState',
        show: 'syncFormState',
    },
    mounted() {
        this.syncFormState();
    },
    methods: {
        resetForm() {
            this.rating = 5;
            this.comment = '';
            this.sending = false;
            this.sent = false;
        },
        syncFormState() {
            const key = this.resetKey;
            const visible = !!this.show;
            if (key !== this._lastResetKey) {
                this.resetForm();
            } else if (!visible && this._lastShow) {
                this.resetForm();
            }
            this._lastResetKey = key;
            this._lastShow = visible;
        },
        submit() {
            if (!this.show || this.sending || this.sent) {
                return;
            }
            /* eslint-disable no-undef */
            const buffer = kiwi.state.getActiveBuffer();
            /* eslint-enable no-undef */
            if (!buffer) {
                return;
            }
            const network = buffer.getNetwork();
            this.sending = true;
            const ok = submitGameFeedback(
                network,
                this.gameLabel,
                this.rating,
                this.comment,
                this.feedbackChannel
            );
            if (ok) {
                this.sent = true;
            }
            this.sending = false;
        },
    },
};
</script>

<style>
.game-feedback {
    margin-top: 14px;
    border: 1px solid var(--comp-border, #b2b2b2);
    border-radius: 8px;
    padding: 10px 12px;
    background: var(--brand-default-bg);
    width: 100%;
    box-sizing: border-box;
}

.game-feedback__title {
    margin: 0 0 6px;
    font-size: 0.95em;
    font-weight: 700;
}

.game-feedback__hint {
    margin: 0 0 10px;
    font-size: 0.85em;
    opacity: 0.9;
}

.game-feedback__row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.game-feedback__label {
    display: block;
    font-size: 0.86em;
    margin-bottom: 4px;
}

.game-feedback__select {
    padding: 4px 6px;
    border-radius: 6px;
    border: 1px solid var(--comp-border, #b2b2b2);
    background: var(--brand-default-bg);
    color: var(--brand-default-fg);
}

.game-feedback__textarea {
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

.game-feedback__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.game-feedback__send {
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    background: var(--brand-primary, #42b992);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
}

.game-feedback__send:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.game-feedback__ok {
    font-size: 0.85em;
    color: #1a7f4a;
    font-weight: 600;
}
</style>
