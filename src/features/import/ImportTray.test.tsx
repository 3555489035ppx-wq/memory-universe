import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { useUiStore } from '../../stores/uiStore';
import { ImportTray } from './ImportTray';

function renderTray(): void {
  render(
    <MemoryRouter initialEntries={['/archive?import=1']}>
      <ImportTray />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useUiStore.setState({
    importOpen: true,
    announcement: '',
    toasts: [],
  });
});

afterEach(() => cleanup());

describe('ImportTray', () => {
  it('explains local processing and exposes an accessible modal dialog', async () => {
    renderTray();

    expect(screen.getByRole('dialog', { name: '把照片带入记忆宇宙' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    expect(screen.getByText(/不上传服务器/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: '关闭' })).toHaveFocus());
  });

  it('validates each selected file without hiding valid files from the same selection', () => {
    renderTray();
    const input = screen.getByLabelText(/拖入照片，或从设备选择/);
    const valid = new File([new Uint8Array([1])], 'memory.jpg', { type: 'image/jpeg' });
    const invalid = new File([new Uint8Array([1])], 'notes.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [valid, invalid] } });

    expect(screen.getByText('memory.jpg')).toBeInTheDocument();
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始处理 1 张' })).toBeEnabled();
    expect(screen.getByText(/当前只支持 JPEG/)).toBeInTheDocument();
  });

  it('closes without mutating files when no import is running', async () => {
    const user = userEvent.setup();
    renderTray();

    await user.click(screen.getByRole('button', { name: '关闭' }));

    expect(useUiStore.getState().importOpen).toBe(false);
  });
});
