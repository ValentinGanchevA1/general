import React from 'react';
import { render } from '@testing-library/react-native';
import { Circle, Path, RadialGradient } from 'react-native-svg';

import { NexaWordmark } from './NexaWordmark';

describe('NexaWordmark', () => {
  it('keeps the full lockup accessible as one image', () => {
    const ui = render(<NexaWordmark />);
    expect(ui.getByLabelText('NEXUS').props.accessibilityRole).toBe('image');
  });

  it('renders the reference eye as open upper and split lower arcs around a glowing iris', () => {
    const ui = render(<NexaWordmark />);
    const paths = ui.UNSAFE_getAllByType(Path);
    const circles = ui.UNSAFE_getAllByType(Circle);

    // One geometric word path, three upper-lid strokes and three for each lower half.
    expect(paths).toHaveLength(10);
    expect(paths.filter((node) => node.props.fillRule === 'evenodd')).toHaveLength(1);
    expect(paths.filter((node) => node.props.strokeWidth === 6)).toHaveLength(2);

    // The central pupil is distinct from the surrounding iris rings and glow.
    expect(circles).toHaveLength(5);
    const pupil = circles[4];
    if (!pupil) throw new Error('Expected NEXUS central pupil circle');
    expect(pupil.props.fill).toMatch(/^url\(#nexa-wordmark-pupil-/);
    expect(ui.UNSAFE_getAllByType(RadialGradient)).toHaveLength(1);
  });
});
