const W = 480;
const H = 270;
const AIR = 0;

export function createWalkerState() {
  return {
    active: false,
    x: W / 2,
    y: 8,
    vy: 0,
    facing: 1,
    phase: 'out',
    frame: 0,
  };
}

function footCell(walker) {
  return { x: Math.round(walker.x), y: Math.round(walker.y) };
}

function below(get, x, y) {
  if (y >= H - 1) return null;
  return get(x, y + 1);
}

function bears(ctx, material) {
  if (material == null) return true;
  if (ctx.bear) return ctx.bear(material);
  return material !== AIR;
}

function passable(ctx, x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  const material = ctx.get(x, y);
  if (ctx.open) return ctx.open(material);
  return material === AIR;
}

function supported(ctx, x, y) {
  return bears(ctx, below(ctx.get, x, y));
}

export function stepWalker(walker, input, ctx) {
  if (!walker.active || walker.phase === 'out') return;
  walker.frame = (walker.frame + 1) & 3;
  if (input?.facing) walker.facing = input.facing;

  if (walker.phase === 'drop') {
    for (let n = 0; n < 2; n++) {
      const f = footCell(walker);
      if (supported(ctx, f.x, f.y)) {
        walker.phase = 'ground';
        walker.y = f.y;
        walker.vy = 0;
        return;
      }
      walker.y += 1;
    }
    if (walker.y >= H - 2) walker.phase = 'ground';
    return;
  }

  let dx = 0;
  let dy = 0;
  if (input?.left) dx -= 1;
  if (input?.right) dx += 1;
  if (input?.down) dy += 1;
  if (dx !== 0) walker.facing = dx > 0 ? 1 : -1;
  if (dx !== 0 && (dy !== 0 || input?.up)) return;
  if (input?.up) input.jump = true;

  if (input?.jump && walker.phase === 'ground') {
    input.jump = false;
    const f = footCell(walker);
    const landX = f.x + walker.facing;
    if (passable(ctx, f.x, f.y - 1) && passable(ctx, landX, f.y - 1)) {
      walker.x = landX;
      walker.y = f.y - 1;
      walker.phase = supported(ctx, landX, f.y - 1) ? 'ground' : 'drop';
      return;
    }
  }

  if (dx === 0 && dy === 0) return;
  if (dx !== 0 && dy !== 0) return;

  const f = footCell(walker);
  const tx = f.x + dx;
  const ty = f.y + dy;
  if (!passable(ctx, tx, ty)) return;
  walker.x = tx;
  walker.y = ty;
  walker.phase = supported(ctx, tx, ty) ? 'ground' : 'drop';
}

export function dropWalkerIn(walker, x, y) {
  walker.active = true;
  walker.x = Math.max(2, Math.min(W - 3, x));
  walker.y = Math.max(4, y);
  walker.vy = 0;
  walker.phase = 'drop';
  walker.facing = 1;
}

export function stepWalkerOut(walker) {
  walker.active = false;
  walker.phase = 'out';
}

export function facingCell(walker) {
  const f = footCell(walker);
  return { x: f.x + walker.facing, y: f.y };
}
