// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import ProgressBar from './ProgressBar';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return { container, root };
}

describe('ProgressBar — a plain track+fill meter, no threshold', () => {
  it('computes percentage from value/max and reflects it via ARIA', () => {
    const { container } = mount(<ProgressBar value={30} max={50} label="Push progress" />);
    const track = container.querySelector('[role="progressbar"]');
    expect(track.getAttribute('aria-valuenow')).toBe('60');
    expect(container.textContent).toContain('60%');
    expect(container.textContent).toContain('Push progress');
  });

  it('defaults max to 100', () => {
    const { container } = mount(<ProgressBar value={42} />);
    expect(container.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('42');
  });

  it('clamps out-of-range values to 0-100', () => {
    const over = mount(<ProgressBar value={999} max={100} />).container;
    const under = mount(<ProgressBar value={-20} max={100} />).container;
    expect(over.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('100');
    expect(under.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('0');
  });

  it('hides the value readout when showValue is false', () => {
    const { container } = mount(<ProgressBar value={50} showValue={false} />);
    expect(container.textContent).not.toContain('%');
  });

  it('never divides by a zero/negative max', () => {
    const { container } = mount(<ProgressBar value={10} max={0} />);
    expect(container.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('10');
  });
});
