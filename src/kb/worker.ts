// Builds + autoroutes a keyboard off the UI thread.
import { buildKeyboard, Keyboard } from './keyboard';
self.onmessage = (e: MessageEvent<Keyboard>) => {
  try { (self as unknown as Worker).postMessage({ ok: true, build: buildKeyboard(e.data) }); }
  catch (err) { (self as unknown as Worker).postMessage({ ok: false, error: String((err as Error)?.message ?? err) }); }
};
