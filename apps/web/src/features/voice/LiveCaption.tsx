'use client';
import { LIVE_VOICE_FRAME_BYTES, zLiveVoiceServerMessage } from '@lore/shared/dto/voice';
import { AudioLines } from 'lucide-react';
import { useEffect, useState } from 'react';

const OUTPUT_RATE = 24_000;

export function liveVoiceUrl(conversationId: string, location = window.location) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/v1/voice/live?conversationId=${encodeURIComponent(conversationId)}`;
}

export function resampleMono(input: Float32Array, inputRate: number, outputRate = OUTPUT_RATE) {
  if (inputRate === outputRate) return input.slice();
  const ratio = inputRate / outputRate;
  const output = new Float32Array(Math.max(1, Math.floor(input.length / ratio)));
  for (let i = 0; i < output.length; i += 1) {
    const start = i * ratio;
    const end = Math.min(input.length, (i + 1) * ratio);
    if (ratio <= 1) {
      const at = Math.min(input.length - 1, Math.floor(start));
      const next = Math.min(input.length - 1, at + 1);
      const fraction = start - at;
      output[i] = input[at]! * (1 - fraction) + input[next]! * fraction;
      continue;
    }
    let total = 0;
    let count = 0;
    for (let cursor = Math.floor(start); cursor < Math.ceil(end); cursor += 1) {
      if (cursor >= 0 && cursor < input.length) {
        total += input[cursor]!;
        count += 1;
      }
    }
    output[i] = count ? total / count : 0;
  }
  return output;
}

export function pcm16le(input: Float32Array): Uint8Array {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]!));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return bytes;
}

export class PcmFrameBuffer {
  private pending = new Uint8Array(0);

  push(chunk: Uint8Array): Uint8Array[] {
    const joined = new Uint8Array(this.pending.length + chunk.length);
    joined.set(this.pending);
    joined.set(chunk, this.pending.length);
    const frames: Uint8Array[] = [];
    let offset = 0;
    while (joined.length - offset >= LIVE_VOICE_FRAME_BYTES) {
      frames.push(joined.slice(offset, offset + LIVE_VOICE_FRAME_BYTES));
      offset += LIVE_VOICE_FRAME_BYTES;
    }
    this.pending = joined.slice(offset);
    return frames;
  }

  flushPadded(): Uint8Array | null {
    if (!this.pending.length) return null;
    const frame = new Uint8Array(LIVE_VOICE_FRAME_BYTES);
    frame.set(this.pending);
    this.pending = new Uint8Array(0);
    return frame;
  }
}

/** Live cumulative captions for C1's authenticated voice-note recorder. */
export function LiveCaption({
  stream,
  active,
  conversationId,
}: { stream: MediaStream | null; active: boolean; conversationId: string }) {
  const [caption, setCaption] = useState('');
  const [status, setStatus] = useState<'connecting' | 'listening' | 'error'>('connecting');

  useEffect(() => {
    if (!active || !stream) return;
    let disposed = false;
    const socket = new WebSocket(liveVoiceUrl(conversationId));
    socket.binaryType = 'arraybuffer';
    const framer = new PcmFrameBuffer();
    const queued: Uint8Array[] = [];
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(context.destination);

    const send = (frame: Uint8Array) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(frame);
      else if (socket.readyState === WebSocket.CONNECTING && queued.length < 25) queued.push(frame);
    };
    processor.onaudioprocess = (event) => {
      if (disposed) return;
      const samples = resampleMono(event.inputBuffer.getChannelData(0), context.sampleRate);
      for (const frame of framer.push(pcm16le(samples))) send(frame);
    };
    socket.onopen = () => {
      for (const frame of queued.splice(0)) socket.send(frame);
    };
    socket.onmessage = (event) => {
      let raw: unknown;
      try {
        raw = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const message = zLiveVoiceServerMessage.safeParse(raw);
      if (!message.success) return;
      if (message.data.type === 'ready') setStatus('listening');
      if (message.data.type === 'transcript') setCaption(message.data.text);
      if (message.data.type === 'error') setStatus('error');
    };
    socket.onerror = () => setStatus('error');
    socket.onclose = (event) => {
      if (!disposed && event.code !== 1000) setStatus('error');
    };

    return () => {
      disposed = true;
      processor.onaudioprocess = null;
      source.disconnect();
      processor.disconnect();
      mute.disconnect();
      void context.close();
      if (socket.readyState === WebSocket.OPEN) {
        const finalFrame = framer.flushPadded();
        if (finalFrame) socket.send(finalFrame);
        socket.send(JSON.stringify({ type: 'end' }));
        window.setTimeout(() => socket.close(1000, 'recording complete'), 2_000);
      } else socket.close();
    };
  }, [active, conversationId, stream]);

  return (
    <div
      className="mx-3 mb-2 flex min-h-9 items-center gap-2 rounded-xl bg-ai-tint px-3 py-2 text-[12px] text-ink"
      aria-live="polite"
    >
      <AudioLines size={16} className="shrink-0 text-ai" />
      <span className="line-clamp-2">
        {caption ||
          (status === 'error'
            ? 'Live captions unavailable — the voice note will still be transcribed.'
            : status === 'listening'
              ? 'Listening…'
              : 'Connecting live captions…')}
      </span>
    </div>
  );
}
