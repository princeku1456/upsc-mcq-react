/* =========================================
   2. QUIZ TIMER
   Same logic as utils.js QuizTimer. The only adaptation for React:
   instead of writing directly into a DOM node, it invokes an
   onDisplay callback so a component can render the value.
   Tick cadence, pause/resume, low-time threshold (<180s) and
   completion behaviour are identical.
   ========================================= */
export class QuizTimer {
    constructor(onDisplay, onTick, onComplete) {
        this.onDisplay = onDisplay;
        this.onTick = onTick;
        this.onComplete = onComplete;
        this.interval = null;
        this.secondsRemaining = 0;
        this.isPaused = false;
    }

    start(durationSeconds, startFrom = null) {
        this.stop();
        this.secondsRemaining = startFrom !== null ? startFrom : durationSeconds;
        this.isPaused = false;
        this.updateDisplay();

        this.interval = setInterval(() => {
            if (!this.isPaused) {
                this.secondsRemaining--;
                this.updateDisplay();

                if (this.onTick) this.onTick(this.secondsRemaining);

                if (this.secondsRemaining <= 0) {
                    this.stop();
                    if (this.onComplete) this.onComplete();
                }
            }
        }, 1000);
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
    }

    getTimeLeft() {
        return this.secondsRemaining;
    }

    updateDisplay() {
        const m = Math.floor(this.secondsRemaining / 60);
        const s = this.secondsRemaining % 60;
        const text = `${m}:${s < 10 ? "0" : ""}${s}`;
        const lowTime = this.secondsRemaining < 180;
        if (this.onDisplay) this.onDisplay(text, lowTime, this.secondsRemaining);
    }
}
