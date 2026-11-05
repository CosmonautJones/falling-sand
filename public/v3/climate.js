const DURATION = 720;
const YEAR = DURATION * 3;

export const SEASONS = Object.freeze([
  Object.freeze({ id: 'rain', name: 'Rain', duration: DURATION }),
  Object.freeze({ id: 'dry', name: 'Dry', duration: DURATION }),
  Object.freeze({ id: 'recovery', name: 'Recovery', duration: DURATION }),
]);

export function seasonAt(tick) {
  return {
    ...SEASONS[Math.floor((tick % YEAR) / DURATION)],
    year: Math.floor(tick / YEAR) + 1,
    elapsed: tick % DURATION,
  };
}
