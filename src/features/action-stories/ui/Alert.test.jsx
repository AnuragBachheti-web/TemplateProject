// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import Alert from './Alert';

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

describe('Alert — a persistent, in-place notice (distinct from Toast\'s transient one)', () => {
  it('renders a full banner with title + body by default', () => {
    const { container } = mount(
      <Alert tone="warning" title="Auto-revert not armed">
        Nothing has been written yet.
      </Alert>,
    );
    expect(container.textContent).toContain('Auto-revert not armed');
    expect(container.textContent).toContain('Nothing has been written yet.');
  });

  it('renders a tight inline pill in compact mode, no title slot', () => {
    const { container } = mount(
      <Alert tone="critical" compact>
        Something went wrong on our end.
      </Alert>,
    );
    expect(container.querySelector('span[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('Something went wrong on our end.');
  });

  it('uses role="alert" (assertive) for warning/critical and role="status" (polite) for info/success', () => {
    const critical = mount(<Alert tone="critical">x</Alert>).container.firstChild;
    const warning = mount(<Alert tone="warning">x</Alert>).container.firstChild;
    const info = mount(<Alert tone="info">x</Alert>).container.firstChild;
    const success = mount(<Alert tone="success">x</Alert>).container.firstChild;
    expect(critical.getAttribute('role')).toBe('alert');
    expect(warning.getAttribute('role')).toBe('alert');
    expect(info.getAttribute('role')).toBe('status');
    expect(success.getAttribute('role')).toBe('status');
  });

  it('shows a dismiss button only when onDismiss is provided, and calls it on click', () => {
    const onDismiss = vi.fn();
    const { container: withDismiss } = mount(
      <Alert tone="info" onDismiss={onDismiss}>
        x
      </Alert>,
    );
    const button = withDismiss.querySelector('button[aria-label="Dismiss"]');
    expect(button).not.toBeNull();
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    const { container: withoutDismiss } = mount(<Alert tone="info">x</Alert>);
    expect(withoutDismiss.querySelector('button')).toBeNull();
  });

  it('only ever uses rf-status-*/rf-brand-* tokens, never a hardcoded Tailwind palette literal', () => {
    for (const tone of ['info', 'success', 'warning', 'critical']) {
      const { container } = mount(<Alert tone={tone}>x</Alert>);
      const cls = container.firstChild.className;
      expect(cls).toMatch(/rf-(status|brand)-/);
      expect(cls).not.toMatch(/rose|emerald|amber|indigo/);
    }
  });
});
