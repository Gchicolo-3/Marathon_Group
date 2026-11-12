import { NextResponse } from 'next/server';
import { ensureSchema } from '../../../lib/schema';

// Wraps a keep warm route: schema first, JSON errors with a readable message.
export function handler(fn) {
  return async (request, ctx) => {
    try {
      await ensureSchema();
      const out = await fn(request, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (err) {
      console.error('keepwarm route:', err.message);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  };
}
