import React from 'react';
import {render} from '@testing-library/react-native';

import {PinInteractionHost} from '../PinInteractionHost';

const previewProps = {
  name: 'Peer',
  avatarUrl: null,
  viewerMode: 'social' as const,
  peerAllowsDating: false,
};

describe('PinInteractionHost', () => {
  it('hands a loaded user pin directly to detail without rendering a preview', () => {
    const onOpenDetail = jest.fn();
    const result = render(
      <PinInteractionHost
        visible
        previewProps={previewProps}
        onQuickWave={jest.fn()}
        onQuickLike={jest.fn()}
        onOpenDetail={onOpenDetail}
        onDismiss={jest.fn()}
      />,
    );

    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(result.toJSON()).toBeNull();
  });

  it('hands off only once per visible preview cycle', () => {
    const onOpenDetail = jest.fn();
    const callbacks = {
      onQuickWave: jest.fn(),
      onQuickLike: jest.fn(),
      onOpenDetail,
      onDismiss: jest.fn(),
    };

    const result = render(
      <PinInteractionHost visible previewProps={previewProps} {...callbacks} />,
    );
    expect(onOpenDetail).toHaveBeenCalledTimes(1);

    result.rerender(
      <PinInteractionHost
        visible
        previewProps={{...previewProps}}
        {...callbacks}
      />,
    );
    expect(onOpenDetail).toHaveBeenCalledTimes(1);

    result.rerender(
      <PinInteractionHost visible={false} previewProps={previewProps} {...callbacks} />,
    );
    result.rerender(
      <PinInteractionHost visible previewProps={previewProps} {...callbacks} />,
    );
    expect(onOpenDetail).toHaveBeenCalledTimes(2);
  });
});
