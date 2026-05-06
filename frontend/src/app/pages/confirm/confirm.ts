import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { CommitmentTask } from '../../models/commitment';
import { CommitmentStorageService } from '../../services/commitment-storage';
import { TopbarComponent } from '../../components/topbar';
import { formatEuro } from '../../utils/currency';

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [RouterModule, TopbarComponent],
  templateUrl: './confirm.html',
  styleUrls: ['./confirm.css'],
})
export class ConfirmComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storage = inject(CommitmentStorageService);

  protected readonly version = signal(0);

  protected readonly task = computed<CommitmentTask | undefined>(() => {
    this.version();
    const taskId = this.route.snapshot.queryParamMap.get('taskId');
    return taskId ? this.storage.getById(taskId) : this.storage.getLatestDraft();
  });

  protected readonly totalMinutes = computed(() => {
    const task = this.task();
    return task?.steps.reduce((sum, step) => sum + step.timeLimitMinutes, 0) ?? 0;
  });

  protected readonly formatEuro = formatEuro;

  protected proceed(): void {
    const task = this.task();
    if (!task) return;
    this.storage.update(task.id, { confirmedAt: new Date().toISOString() });
    this.router.navigate(['/bank'], { queryParams: { taskId: task.id } });
  }
}
