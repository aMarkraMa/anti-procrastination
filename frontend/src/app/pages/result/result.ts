import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { CommitmentTask } from '../../models/commitment';
import { CommitmentStorageService } from '../../services/commitment-storage';
import { TopbarComponent } from '../../components/topbar';
import { ConfettiComponent } from '../../components/confetti';
import { formatEuro, roundCents } from '../../utils/currency';

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [RouterModule, TopbarComponent, ConfettiComponent],
  templateUrl: './result.html',
  styleUrls: ['./result.css'],
})
export class ResultComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly storage = inject(CommitmentStorageService);

  protected readonly confettiTrigger = signal(0);
  protected readonly animatedEarned = signal(0);
  private rafId: number | null = null;

  protected readonly task = computed<CommitmentTask | undefined>(() => {
    const taskId = this.route.snapshot.queryParamMap.get('taskId');
    return taskId ? this.storage.getById(taskId) : this.storage.getLatest();
  });

  protected readonly isSuccess = computed(() => this.task()?.status === 'Completed');

  protected readonly earnedCredit = computed(() =>
    roundCents(
      this.task()
        ?.steps.filter((s) => s.status === 'Completed')
        .reduce((sum, s) => sum + s.assignedCredit, 0) ?? 0,
    ),
  );

  protected readonly lostCredit = computed(() => {
    const t = this.task();
    if (!t) return 0;
    return roundCents(t.commitmentAmount - this.earnedCredit());
  });

  protected readonly formatEuro = formatEuro;

  protected readonly extensionsUsedTotal = computed(
    () => this.task()?.steps.reduce((sum, s) => sum + s.extensionsUsed, 0) ?? 0,
  );

  protected statusLabel(): string {
    const t = this.task();
    if (!t) return '';
    return t.status.toUpperCase();
  }

  protected failedStepLabel(): string {
    const t = this.task();
    if (!t) return '';
    const failed = t.steps.find((s) => s.status === 'Failed');
    if (!failed) return '';
    return `Step ${failed.order} — ${failed.title}`;
  }

  protected hardestStep(): string {
    const t = this.task();
    if (!t) return '—';
    const sorted = [...t.steps].sort((a, b) => b.extensionsUsed - a.extensionsUsed);
    return sorted[0]?.extensionsUsed
      ? `Step ${sorted[0].order} (${sorted[0].title})`
      : '—';
  }

  ngOnInit(): void {
    if (this.isSuccess()) {
      this.confettiTrigger.set(this.confettiTrigger() + 1);
    }
    this.animateCount(this.earnedCredit(), this.isSuccess() ? 1500 : 700);
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private animateCount(target: number, durationMs: number): void {
    if (target <= 0) {
      this.animatedEarned.set(0);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic for a satisfying ramp-up
      const eased = 1 - Math.pow(1 - t, 3);
      this.animatedEarned.set(roundCents(target * eased));
      if (t < 1) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.animatedEarned.set(target);
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  protected timeUsed(): string {
    const t = this.task();
    if (!t || !t.startedAt) return '—';
    const end = t.completedAt ?? t.failedAt ?? new Date().toISOString();
    const ms = new Date(end).getTime() - new Date(t.startedAt).getTime();
    if (ms < 0) return '—';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h${m.toString().padStart(2, '0')}m`;
    return `${m}m${s.toString().padStart(2, '0')}s`;
  }
}
