import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterModule],
  template: `
    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" routerLink="/" aria-label="Deadline Bank home">
          <span class="brand-mark" aria-hidden="true">▲</span>
          <span class="brand-name">Deadline Bank</span>
        </a>

        <nav class="topbar-nav" aria-label="Primary">
          <a routerLink="/create" class="nav-link">New commitment</a>
          @if (showSignedIn) {
            <span class="signed-in">{{ accountLabel }}</span>
          }
        </nav>
      </div>
    </header>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .topbar {
        position: sticky;
        top: 0;
        z-index: 50;
        border-bottom: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: saturate(180%) blur(8px);
        -webkit-backdrop-filter: saturate(180%) blur(8px);
      }

      .topbar-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        height: 64px;
        width: min(100%, var(--max-w));
        margin: 0 auto;
        padding: 0 24px;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: var(--fg);
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      .brand-mark {
        font-size: 18px;
        line-height: 1;
        color: var(--fg);
      }

      .brand-name {
        font-size: 15px;
      }

      .topbar-nav {
        display: inline-flex;
        align-items: center;
        gap: 16px;
      }

      .nav-link {
        font-size: 14px;
        font-weight: 500;
        color: var(--fg-muted);
        padding: 6px 10px;
        border-radius: var(--radius-sm);
      }

      .nav-link:hover {
        background: var(--bg-muted);
        color: var(--fg);
      }

      .signed-in {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--fg-subtle);
        padding: 5px 10px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--bg);
      }

      @media (max-width: 600px) {
        .nav-link {
          display: none;
        }
      }
    `,
  ],
})
export class TopbarComponent {
  @Input() showSignedIn = false;
  @Input() accountLabel = '';
}
