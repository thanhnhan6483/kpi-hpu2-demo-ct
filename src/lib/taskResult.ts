export type SynthTaskStatus = 'not_started' | 'in_progress' | 'done';

export interface TaskSynthJob {
  title: string;
  chiTieu?: string;
  result?: string;
  status: string;
}

export interface TaskSynthMeta {
  chiTieu?: string;
  taskResult?: string;
  taskStatus?: string;
}

export interface TaskSynthResult {
  totalSub: number;
  doneSub: number;
  status: SynthTaskStatus;
  result: string;
}

export function parsePct(v: string | undefined | null): number | null {
  if (!v) return null;
  const m = String(v).trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
  return m ? Number(m[1]) : null;
}

export function synthesizeTask(task: TaskSynthMeta, jobs: TaskSynthJob[]): TaskSynthResult {
  const totalSub = jobs.length;
  if (totalSub === 0) {
    return {
      totalSub: 0,
      doneSub: 0,
      status: task.taskStatus === 'in_progress' ? 'in_progress' : 'not_started',
      result: task.taskResult || '',
    };
  }

  const doneSub = jobs.filter(j => j.status === 'done').length;
  let status: SynthTaskStatus;
  if (doneSub === totalSub) status = 'done';
  else if (jobs.some(j => j.status !== 'assigned')) status = 'in_progress';
  else status = 'not_started';

  const taskChiTieuPct = parsePct(task.chiTieu);
  const jobPcts = jobs.map(j => ({ chiTieu: parsePct(j.chiTieu), result: parsePct(j.result) }));

  let result: string;
  if (taskChiTieuPct !== null && jobPcts.every(p => p.chiTieu !== null)) {
    const totalWeight = jobPcts.reduce((s, p) => s + (p.chiTieu as number), 0);
    const weightedSum = jobPcts.reduce((s, p) => s + ((p.chiTieu as number) * (p.result ?? 0)) / 100, 0);
    const achieved = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
    result = `${achieved}%`;
  } else {
    result = `${doneSub}/${totalSub} công việc hoàn thành`;
  }

  return { totalSub, doneSub, status, result };
}