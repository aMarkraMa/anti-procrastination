import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';

import { formatEuro } from '../utils/currency';

/**
 * Centered "step completed" overlay with the credit reward.
 * Appears when `trigger` changes and animates out after ~1.4s.
 */
@Component({
  selector: 'app-step-reward',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="reward-overlay" [class.is-final]="isFinal" aria-live="polite">
        <div class="reward-card">
          <span class="check" aria-hidden="true">✓</span>
          <p class="label">{{ label() }}</p>
          <strong class="amount mono">+€{{ formatted() }}</strong>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 950;
      }

      .reward-overlay {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        animation: bg-fade 1.4s ease-out forwards;
      }

      .reward-overlay.is-final {
        animation-duration: 1.7s;
      }

      .reward-card {
        display: grid;
        place-items: center;
        gap: 8px;
        padding: 24px 36px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid var(--border);
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.18);
        animation: pop 1.4s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
        min-width: 240px;
      }

      .check {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #ecfdf5;
        color: #059669;
        font-size: 26px;
        font-weight: 700;
        animation: check-pulse 0.9s ease-out;
      }

      .label {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        color: var(--fg-muted);
        letter-spacing: 0.02em;
      }

      .amount {
        font-size: 36px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #059669;
      }

      @keyframes pop {
        0% {
          opacity: 0;
          transform: scale(0.7) translateY(20px);
        }
        20% {
          opacity: 1;
          transform: scale(1.04) translateY(0);
        }
        70% {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
        100% {
          opacity: 0;
          transform: scale(1) translateY(-12px);
        }
      }

      @keyframes check-pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55);
        }
        70% {
          box-shadow: 0 0 0 18px rgba(16, 185, 129, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
        }
      }

      @keyframes bg-fade {
        0% {
          background: rgba(255, 255, 255, 0);
        }
        20% {
          background: rgba(255, 255, 255, 0.55);
          backdrop-filter: blur(2px);
        }
        100% {
          background: rgba(255, 255, 255, 0);
          backdrop-filter: blur(0);
        }
      }
    `,
  ],
})
export class StepRewardComponent implements OnChanges {
  @Input() amount = 0;
  @Input() trigger: number | string = 0;
  @Input() isFinal = false;

  protected readonly visible = signal(false);
  protected readonly formatted = signal('0.00');
  protected readonly label = signal('Step completed');

  private dismissTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['trigger'] && !changes['trigger'].firstChange) {
      this.show();
    }
  }

  private show(): void {
    this.formatted.set(formatEuro(this.amount));
    this.label.set(this.isFinal ? 'All steps complete' : 'Step completed');
    this.visible.set(true);

    if (this.dismissTimeout !== null) clearTimeout(this.dismissTimeout);
    this.dismissTimeout = setTimeout(
      () => this.visible.set(false),
      this.isFinal ? 1700 : 1400,
    );
  }
}
