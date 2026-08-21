import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';

/**
 * Reads the container metadata that an export actually wrote.  This stays out
 * of the export hot path, but gives tests and future diagnostics an honest
 * way to prove the generated file instead of trusting requested settings.
 */
export interface EncodedMp4Metadata {
  width: number;
  height: number;
  videoCodec: string | null;
  audioCodec: string | null;
  sampleRate: number | null;
  durationSeconds: number | null;
  byteLength: number;
}

export async function inspectEncodedMp4(blob: Blob): Promise<EncodedMp4Metadata> {
  const input = new Input({
    source: new BlobSource(blob),
    formats: ALL_FORMATS,
  });

  try {
    const [videoTrack, audioTrack, durationSeconds] = await Promise.all([
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
      input.computeDuration(),
    ]);

    if (!videoTrack || !audioTrack) {
      throw new Error('MP4_OUTPUT_IS_MISSING_A_REQUIRED_TRACK');
    }

    return {
      width: await videoTrack.getDisplayWidth(),
      height: await videoTrack.getDisplayHeight(),
      videoCodec: await videoTrack.getCodec(),
      audioCodec: await audioTrack.getCodec(),
      sampleRate: await audioTrack.getSampleRate(),
      durationSeconds,
      byteLength: blob.size,
    };
  } finally {
    input.dispose();
  }
}
