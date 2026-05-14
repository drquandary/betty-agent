import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SchedulingCard, buildSchedulingPrompt } from './SchedulingCard';

describe('buildSchedulingPrompt', () => {
  it('encodes GPUs, hours, partition, memory', () => {
    const p = buildSchedulingPrompt({
      gpus: 2,
      hours: 4,
      partition: 'dgx-b200',
      memGb: 128,
      notes: '',
    });
    expect(p).toContain('2 GPUs');
    expect(p).toContain('4 hours');
    expect(p).toContain('`dgx-b200`');
    expect(p).toContain('128 GB');
    expect(p).toContain('alternate start times');
  });

  it('singularizes "GPU" and "hour" when count is 1', () => {
    const p = buildSchedulingPrompt({
      gpus: 1,
      hours: 1,
      partition: 'compute',
      memGb: 16,
      notes: '',
    });
    expect(p).toContain('1 GPU ');
    expect(p).toContain('1 hour ');
  });

  it('appends workload notes when provided', () => {
    const p = buildSchedulingPrompt({
      gpus: 4,
      hours: 8,
      partition: 'dgx-b200',
      memGb: 256,
      notes: 'QLoRA fine-tune',
    });
    expect(p).toContain('Workload notes: QLoRA fine-tune');
  });
});

describe('SchedulingCard', () => {
  it('calls onSubmit with the built prompt on valid form', () => {
    const onSubmit = vi.fn();
    const { container } = render(<SchedulingCard onSubmit={onSubmit} />);
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(onSubmit).toHaveBeenCalledOnce();
    const prompt = onSubmit.mock.calls[0][0] as string;
    expect(prompt).toContain('1 GPU');
    expect(prompt).toContain('`dgx-b200`');
  });

  it('rejects walltime out of range', () => {
    const onSubmit = vi.fn();
    const { container } = render(<SchedulingCard onSubmit={onSubmit} />);
    const hoursInput = screen.getByLabelText(/Walltime/i) as HTMLInputElement;
    fireEvent.change(hoursInput, { target: { value: '999' } });
    const form = container.querySelector('form');
    fireEvent.submit(form!);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/0\.5 and 168/i);
  });
});
