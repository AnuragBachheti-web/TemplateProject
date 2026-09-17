// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import Avatar from './Avatar';

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

describe('Avatar — initials for a named owner/agent, an icon fallback otherwise', () => {
  it('renders two initials for a two-word name', () => {
    const { container } = mount(<Avatar name="Jordan Blake" />);
    expect(container.textContent).toBe('JB');
  });

  it('renders the first two letters for a single-word name', () => {
    const { container } = mount(<Avatar name="Me" />);
    expect(container.textContent).toBe('ME');
  });

  it('falls back to the default person icon with no name', () => {
    const { container } = mount(<Avatar />);
    expect(container.querySelector('.fa-user')).not.toBeNull();
    expect(container.textContent).toBe('');
  });

  it('renders a custom icon when given and no name', () => {
    const { container } = mount(<Avatar icon="fa-solid fa-robot" />);
    expect(container.querySelector('.fa-robot')).not.toBeNull();
  });

  it('carries an accessible name via aria-label/title', () => {
    const { container } = mount(<Avatar name="Jordan Blake" />);
    const node = container.firstChild;
    expect(node.getAttribute('aria-label')).toBe('Jordan Blake');
    expect(node.getAttribute('title')).toBe('Jordan Blake');
  });

  it('applies the requested size and tone', () => {
    const { container } = mount(<Avatar name="Me" size="lg" tone="neutral" />);
    const cls = container.firstChild.className;
    expect(cls).toMatch(/h-10 w-10/);
    expect(cls).toMatch(/rf-surface-sunken/);
  });
});
