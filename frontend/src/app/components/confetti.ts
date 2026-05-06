import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface Particle {
  el: HTMLDivElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  life: number;
  maxLife: number;
}

const COLORS = [
  '#0070f3',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#22d3ee',
  '#facc15',
  '#ef4444',
];

/**
 * Lightweight, dependency-free confetti.
 *
 * Usage:
 *   <app-confetti [trigger]="version()" [intensity]="'big'"></app-confetti>
 *
 * Each time `trigger` changes, a new burst is fired. `intensity` is
 * 'small' (~24 particles) or 'big' (~120 particles, multi-burst).
 */
@Component({
  selector: 'app-confetti',
  standalone: true,
  template: '<div #host class="confetti-host" aria-hidden="true"></div>',
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 1000;
        overflow: hidden;
      }

      .confetti-host {
        position: relative;
        width: 100%;
        height: 100%;
      }

      .confetti-piece {
        position: absolute;
        top: 0;
        left: 0;
        width: 8px;
        height: 14px;
        border-radius: 2px;
        will-change: transform, opacity;
        opacity: 0;
      }
    `,
  ],
})
export class ConfettiComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  @Input() trigger: number | string = 0;
  @Input() intensity: 'small' | 'big' = 'small';

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private rafId: number | null = null;
  private particles: Particle[] = [];
  private lastT = 0;
  private hasFired = false;

  ngAfterViewInit(): void {
    if (this.trigger && !this.hasFired) {
      this.fire();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isBrowser) return;
    if (changes['trigger'] && !changes['trigger'].firstChange) {
      this.fire();
    } else if (changes['trigger']?.firstChange && this.trigger) {
      // Will be handled in ngAfterViewInit once the host is ready.
    }
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.particles.forEach((p) => p.el.remove());
    this.particles = [];
  }

  private fire(): void {
    if (!this.isBrowser || !this.hostRef) return;
    this.hasFired = true;
    const count = this.intensity === 'big' ? 120 : 24;
    this.spawnBurst(count);

    if (this.intensity === 'big') {
      setTimeout(() => this.spawnBurst(60), 240);
      setTimeout(() => this.spawnBurst(60), 520);
    }

    if (this.rafId === null) {
      this.lastT = performance.now();
      this.tick(this.lastT);
    }
  }

  private spawnBurst(count: number): void {
    const host = this.hostRef.nativeElement;
    const w = host.clientWidth;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
      el.style.opacity = '1';
      const angle = Math.random() * Math.PI - Math.PI / 2;
      const speed = 320 + Math.random() * 360;
      const startX = w / 2 + (Math.random() - 0.5) * w * 0.4;
      const startY = -10;
      const lifeMs = 1700 + Math.random() * 900;
      const p: Particle = {
        el,
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed * 0.6,
        vy: Math.sin(angle) * speed * 0.6 + 240,
        rot: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 720,
        life: 0,
        maxLife: lifeMs,
      };
      el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
      host.appendChild(el);
      this.particles.push(p);
    }
  }

  private tick = (now: number): void => {
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    const host = this.hostRef.nativeElement;
    const h = host.clientHeight;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt * 1000;
      p.vy += 900 * dt; // gravity
      p.vx *= 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vRot * dt;
      const lifeRatio = p.life / p.maxLife;
      const opacity = lifeRatio < 0.85 ? 1 : Math.max(0, 1 - (lifeRatio - 0.85) / 0.15);
      p.el.style.opacity = String(opacity);
      p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;

      if (p.life >= p.maxLife || p.y > h + 40) {
        p.el.remove();
        this.particles.splice(i, 1);
      }
    }

    if (this.particles.length > 0) {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.rafId = null;
    }
  };
}
