// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { LENSES } from '../contract/decisionObject';
import { categoricalColor } from '../blocks/chartPalette';
import LensBar from './LensBar';

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

describe('LensBar — the reference chip row for the three axes never otherwise shown to an operator', () => {
  it('renders lens, persona and mode as three chips, title-cased', () => {
    const { container } = mount(<LensBar decision={{ lens: 'cash', persona: 'controller', mode: 'suggest' }} />);
    expect(container.textContent).toContain('Lens: Cash');
    expect(container.textContent).toContain('Controller');
    expect(container.textContent).toContain('Dial: Suggest');
  });

  it('colors the lens dot by chartPalette.js\'s fixed categorical order, keyed to LENSES', () => {
    const { container } = mount(<LensBar decision={{ lens: 'margin' }} />);
    const dot = container.querySelector('span[style]');
    expect(dot.getAttribute('style')).toContain(categoricalColor(LENSES.indexOf('margin')));
  });

  it('omits a chip whose axis is absent, rather than rendering an empty one', () => {
    const { container } = mount(<LensBar decision={{ lens: 'cash' }} />);
    expect(container.textContent).toContain('Lens: Cash');
    expect(container.querySelectorAll('span').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('Dial:');
  });

  it('renders nothing at all with no decision, or a decision with none of the three axes', () => {
    expect(mount(<LensBar decision={null} />).container.textContent).toBe('');
    expect(mount(<LensBar decision={{}} />).container.textContent).toBe('');
  });

  it('never renders proposal.agents as a chip here (that content is a body panel, not chrome)', () => {
    const { container } = mount(
      <LensBar decision={{ lens: 'cash', proposal: { agents: [{ name: 'Forecaster', role: 'x' }] } }} />,
    );
    expect(container.textContent).not.toContain('Forecaster');
  });
});
