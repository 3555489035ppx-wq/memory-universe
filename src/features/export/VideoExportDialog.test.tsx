import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMemoryFixture } from '../../test/fixtures/memoryFixture';
import { useMemoryTemplateStore } from '../../stores/memoryTemplateStore';
import { useMusicStore } from '../../stores/musicStore';
import { useSceneStore } from '../../stores/sceneStore';

import { VideoExportDialog } from './VideoExportDialog';

const localFile = new File([new Uint8Array([1, 2, 3])], 'local-song.mp3', { type: 'audio/mpeg' });

function prepareDialog(source: 'upload' | 'system'): void {
  const memory = createMemoryFixture({ id: 'export-memory', source: 'personal' });
  useMemoryTemplateStore.getState().exit();
  useMemoryTemplateStore.getState().prepare({
    templateId: 'high-school',
    source: 'personal',
    memoryIds: [memory.id],
  });
  useSceneStore.setState({
    source: 'personal',
    dataStatus: 'ready',
    dataset: { memories: [memory], people: [], places: [], constellations: [] },
  });
  useMusicStore.setState({
    track: source === 'upload'
      ? { id: 'upload', name: '我的上传', fileName: localFile.name, src: 'blob:upload', source, localFile }
      : { id: 'system', name: '系统音乐', fileName: 'system.mp3', src: '/music/high-school/system.mp3', source },
    duration: 12,
    audioPreset: 'studio-master-v1',
  });
}

describe('VideoExportDialog', () => {
  beforeEach(() => {
    prepareDialog('upload');
  });

  afterEach(() => cleanup());

  it('defaults to a mobile-native 2160 × 3840 export contract with a user upload', async () => {
    const user = userEvent.setup();
    render(<VideoExportDialog />);
    await user.click(screen.getByRole('button', { name: '导出视频' }));
    expect(screen.getByRole('dialog', { name: '导出记忆电影' })).toBeVisible();
    expect(screen.getByRole('button', { name: '开始 手机 4K 导出' })).toBeEnabled();
    expect(screen.getByText('2160 × 3840 · 30 fps · H.264 / 高品质音频 MP4')).toBeVisible();
    expect(screen.getByText('录音棚级')).toBeVisible();
  });

  it('allows a system library source to be materialized before the final export path', async () => {
    const user = userEvent.setup();
    prepareDialog('system');
    render(<VideoExportDialog />);
    await user.click(screen.getByRole('button', { name: '导出视频' }));
    expect(screen.getByRole('button', { name: '开始 手机 4K 导出' })).toBeEnabled();
  });
});
