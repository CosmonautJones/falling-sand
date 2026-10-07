// Toast pacing: back-to-back discoveries merge into one card; rites always stand alone.
function summarize(names) {
  const up = names.map(n => n.toUpperCase());
  return up.length <= 2 ? up.join(', ') : `${up.slice(0, 2).join(', ')} +${up.length - 2}`;
}

export function queueToast(queue, t) {
  const last = queue[queue.length - 1];
  if (last && last.kind === 'find' && t.kind === 'find') {
    const names = [...last.names, ...t.names];
    return [...queue.slice(0, -1), { ...t, names, label: 'TRANSMUTED · ' + summarize(names) }];
  }
  return [...queue, t];
}
