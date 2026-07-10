// Small date formatters shared by the dashboard, signals, and activity pages.

// "just now" / "2h ago" / "yesterday" / "3d ago" / "Jun 12"
function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// "07:41 · Jul 8" — activity-feed timestamp from the design.
function runTimestamp(iso) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Chicago',
  });
  const day = d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'America/Chicago',
  });
  return `${time} · ${day}`;
}

module.exports = { timeAgo, runTimestamp };
