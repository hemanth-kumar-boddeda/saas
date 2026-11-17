// Renderer port. The canonical Timeline is the product; renderers are replaceable adapters.
import { Timeline } from "../schema";

export interface RenderOptions {
  quality: "preview" | "final";
  outFile: string; // absolute path chosen by the caller (already inside storage)
  resolveSource: (storageKey: string) => string; // storage key -> readable local path
  workDir: string;
  onProgress?: (p: number) => void | Promise<void>;
}
export interface RenderResult {
  outFile: string;
  measured: Measured; // real ffprobe/ebur128 measurements of the output file
  renderSeconds: number; // wall-clock, for cost accounting
}
export interface Measured {
  width: number; height: number; fps: number; duration: number;
  hasAudio: boolean;
  integratedLufs?: number; // undefined when not measurable
}
export interface RenderProvider {
  name: string;
  render(t: Timeline, o: RenderOptions): Promise<RenderResult>;
}
