// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import ConfirmDialog from './ConfirmDialog';

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

function dialogButtons() {
  return Array.from(document.body.querySelectorAll('[role="dialog"] button'));
}

describe('ConfirmDialog — gates a real action behind an explicit "are you sure"', () => {
  it('shows the title/description and both actions when open', () => {
    const { root } = mount(
      <ConfirmDialog open title="Approve this stage?" description="This can't be undone." onConfirm={() => {}} onCancel={() => {}} />,
    );
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Approve this stage?');
    expect(dialog.textContent).toContain("This can't be undone.");
    const labels = dialogButtons().map((b) => b.textContent);
    expect(labels).toEqual(['Cancel', 'Confirm']);
    act(() => root.unmount());
  });

  it('defaults focus to Cancel, not Confirm — a stray Enter should never confirm', () => {
    const { root } = mount(<ConfirmDialog open title="Start this stage?" onConfirm={() => {}} onCancel={() => {}} />);
    const [cancelButton] = dialogButtons();
    expect(document.activeElement).toBe(cancelButton);
    act(() => root.unmount());
  });

  it('calls onConfirm/onCancel from the respective button', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { root } = mount(<ConfirmDialog open title="Approve?" onConfirm={onConfirm} onCancel={onCancel} />);
    const [cancelButton, confirmButton] = dialogButtons();

    act(() => confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    act(() => cancelButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onCancel).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('while loading, disables both buttons (no double-submit, no cancel mid-flight)', () => {
    const { root } = mount(<ConfirmDialog open title="Start?" onConfirm={() => {}} onCancel={() => {}} loading />);
    for (const button of dialogButtons()) {
      expect(button.disabled).toBe(true);
    }
    act(() => root.unmount());
  });

  it('renders Confirm in the destructive tone only when explicitly asked', () => {
    const { root } = mount(<ConfirmDialog open title="Delete?" onConfirm={() => {}} onCancel={() => {}} tone="destructive" />);
    const [, confirmButton] = dialogButtons();
    expect(confirmButton.className).toMatch(/rf-status-critical/);
    act(() => root.unmount());
  });

  it('renders arbitrary extra content via children (e.g. a reason field) between the description and the buttons', () => {
    const { root } = mount(
      <ConfirmDialog open title="Decline?" description="Say why." onConfirm={() => {}} onCancel={() => {}}>
        <textarea data-testid="reason" />
      </ConfirmDialog>,
    );
    expect(document.body.querySelector('[data-testid="reason"]')).toBeTruthy();
    act(() => root.unmount());
  });

  it('confirmDisabled disables only Confirm, never Cancel', () => {
    const { root } = mount(<ConfirmDialog open title="Decline?" onConfirm={() => {}} onCancel={() => {}} confirmDisabled />);
    const [cancelButton, confirmButton] = dialogButtons();
    expect(cancelButton.disabled).toBe(false);
    expect(confirmButton.disabled).toBe(true);
    act(() => root.unmount());
  });

  it('renders nothing when closed', () => {
    const { container } = mount(<ConfirmDialog open={false} title="Approve?" onConfirm={() => {}} onCancel={() => {}} />);
    expect(container.textContent).toBe('');
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });
});
