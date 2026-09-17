// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import Chip from './Chip';

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

describe('Chip — a contextual descriptor pill (distinct from Badge, a verdict)', () => {
  it('renders its label', () => {
    const { container } = mount(<Chip>Lens: Cash</Chip>);
    expect(container.textContent).toContain('Lens: Cash');
  });

  it('renders a colored identity dot when dotColor is given, no icon', () => {
    const { container } = mount(
      <Chip dotColor="var(--rf-chart-cat-1)" icon="fa-solid fa-user">
        Lens: Cash
      </Chip>,
    );
    const dot = container.querySelector('span[style]');
    expect(dot).not.toBeNull();
    expect(dot.getAttribute('style')).toContain('var(--rf-chart-cat-1)');
    expect(container.querySelector('.fa-user')).toBeNull();
  });

  it('renders an icon when there is no dotColor', () => {
    const { container } = mount(<Chip icon="fa-solid fa-sliders">Dial: Suggest</Chip>);
    expect(container.querySelector('.fa-sliders')).not.toBeNull();
  });

  it('renders no glyph at all when neither dotColor nor icon is given', () => {
    const { container } = mount(<Chip>Plain</Chip>);
    expect(container.querySelector('i')).toBeNull();
    expect(container.querySelector('span[style]')).toBeNull();
  });
});
