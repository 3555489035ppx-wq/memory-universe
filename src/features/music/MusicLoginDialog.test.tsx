import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MusicAccount } from './musicService';

const connectorMocks = vi.hoisted(() => ({
  getMusicAccountStatus: vi.fn(),
  requestNeteaseQr: vi.fn(),
}));

vi.mock('./musicService', () => ({
  getMusicAccountStatus: connectorMocks.getMusicAccountStatus,
  requestNeteaseQr: connectorMocks.requestNeteaseQr,
  checkNeteaseQr: vi.fn(),
  clearDesktopMusicLogin: vi.fn(),
  getMusicApiBaseUrl: () => 'http://127.0.0.1:3000',
  hasDesktopMusicLogin: () => false,
  logoutMusicProvider: vi.fn(),
  openDesktopMusicLogin: vi.fn(),
  providerLabel: (provider: string) => provider === 'qq' ? 'QQ 音乐' : '网易云音乐',
  saveMusicApiBaseUrl: (value: string) => value,
  submitMusicCookie: vi.fn(),
}));

import { MusicLoginDialog } from './MusicLoginDialog';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MusicLoginDialog', () => {
  it('shows the local connector QR result instead of a browser-generated placeholder', async () => {
    const signedOut: MusicAccount = { provider: 'netease', loggedIn: false };
    connectorMocks.getMusicAccountStatus.mockResolvedValue(signedOut);
    connectorMocks.requestNeteaseQr.mockResolvedValue({
      key: 'connector-issued-key',
      image: 'data:image/png;base64,ZmFrZQ==',
      loginUrl: 'https://music.163.com/login',
    });

    render(
      <MusicLoginDialog
        initialProvider="netease"
        onAuthenticated={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByRole('img', { name: '网易云音乐登录二维码' })).toHaveAttribute(
      'src',
      'data:image/png;base64,ZmFrZQ==',
    );
    expect(screen.queryByText(/Mineradio/i)).not.toBeInTheDocument();
    expect(connectorMocks.requestNeteaseQr).toHaveBeenCalledTimes(1);
  });
});
