// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumb from './Breadcrumb';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter>{element}</MemoryRouter>);
  });
  return { container, root };
}

describe('Breadcrumb — the wayfinding trail, last item is the current page', () => {
  it('renders every item, in order', () => {
    const { container } = mount(
      <Breadcrumb items={[{ label: 'Action Stories', to: '/action-stories' }, { label: 'S10.4' }, { label: 'decide' }]} />,
    );
    expect(container.textContent).toContain('Action Stories');
    expect(container.textContent).toContain('S10.4');
    expect(container.textContent).toContain('decide');
  });

  it('renders an item with `to` as a real link, and the last item as plain text', () => {
    const { container } = mount(
      <Breadcrumb items={[{ label: 'Action Stories', to: '/action-stories' }, { label: 'decide' }]} />,
    );
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/action-stories');
    expect(link.textContent).toBe('Action Stories');

    const current = container.querySelector('[aria-current="page"]');
    expect(current).not.toBeNull();
    expect(current.textContent).toBe('decide');
  });

  it('separates items with a chevron, never before the first item', () => {
    const { container } = mount(<Breadcrumb items={[{ label: 'A', to: '/a' }, { label: 'B', to: '/b' }, { label: 'C' }]} />);
    expect(container.querySelectorAll('.fa-chevron-right').length).toBe(2);
  });

  it('carries an accessible nav landmark', () => {
    const { container } = mount(<Breadcrumb items={[{ label: 'Only' }]} />);
    expect(container.querySelector('nav[aria-label="Breadcrumb"]')).not.toBeNull();
  });
});
