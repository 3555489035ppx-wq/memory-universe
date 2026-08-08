import { isHeicLike, validateDecodedDimensions } from './validateImage';

export class ImageDecodeError extends Error {
  readonly code: 'IMAGE_DECODE_FAILED' | 'HEIC_UNSUPPORTED';

  constructor(code: 'IMAGE_DECODE_FAILED' | 'HEIC_UNSUPPORTED', message: string) {
    super(message);
    this.name = 'ImageDecodeError';
    this.code = code;
  }
}

export interface DecodedImage {
  bitmap: ImageBitmap;
  orientationApplied: boolean;
}

export type OrientationTransform = readonly [number, number, number, number, number, number];

export function orientedDimensions(
  width: number,
  height: number,
  orientation: number | null,
): readonly [number, number] {
  return orientation !== null && orientation >= 5 && orientation <= 8
    ? [height, width]
    : [width, height];
}

export function orientationTransform(
  width: number,
  height: number,
  orientation: number | null,
): OrientationTransform {
  switch (orientation) {
    case 2:
      return [-1, 0, 0, 1, width, 0];
    case 3:
      return [-1, 0, 0, -1, width, height];
    case 4:
      return [1, 0, 0, -1, 0, height];
    case 5:
      return [0, 1, 1, 0, 0, 0];
    case 6:
      return [0, 1, -1, 0, height, 0];
    case 7:
      return [0, -1, -1, 0, height, width];
    case 8:
      return [0, -1, 1, 0, 0, width];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}

export function disposeCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 1;
  canvas.height = 1;
}

export async function decodeImage(file: File, signal?: AbortSignal): Promise<DecodedImage> {
  if (signal?.aborted) throw new DOMException('导入已取消。', 'AbortError');
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
      premultiplyAlpha: 'default',
      colorSpaceConversion: 'default',
    });
    validateDecodedDimensions(bitmap.width, bitmap.height);
    if (signal?.aborted) {
      bitmap.close();
      throw new DOMException('导入已取消。', 'AbortError');
    }
    return { bitmap, orientationApplied: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (isHeicLike(file)) {
      throw new ImageDecodeError(
        'HEIC_UNSUPPORTED',
        '当前浏览器暂时无法直接读取这张 HEIC 照片。建议先转换为 JPG 或 PNG 后再导入。',
      );
    }
    throw new ImageDecodeError('IMAGE_DECODE_FAILED', '照片像素无法解码，文件可能损坏或格式不受支持。');
  }
}

export function normalizeOrientation(
  bitmap: ImageBitmap,
  orientation: number | null,
): HTMLCanvasElement {
  validateDecodedDimensions(bitmap.width, bitmap.height);
  const [outputWidth, outputHeight] = orientedDimensions(bitmap.width, bitmap.height, orientation);
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) {
    disposeCanvas(canvas);
    throw new ImageDecodeError('IMAGE_DECODE_FAILED', '浏览器无法建立图片处理画布。');
  }
  context.setTransform(...orientationTransform(bitmap.width, bitmap.height, orientation));
  context.drawImage(bitmap, 0, 0);
  context.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}
