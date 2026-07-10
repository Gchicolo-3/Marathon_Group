'use client';

import { useEffect, useState } from 'react';

// Live header clock in Central Time, per the design ("14:32 CT").
export function HeaderClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'America/Chicago',
        }) + ' CT'
      );
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <span className="font-mono text-[11px] tabular-nums text-[#5F6B85]" suppressHydrationWarning>
      {time}
    </span>
  );
}
