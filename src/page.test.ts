import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('shipped page', () => {
  it('is a window ES module with a wide canvas game loop and no Node require', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain('type="module"');
    expect(html).toContain('id="stage"');
    expect(html).toContain('Alembic');
    expect(html).not.toMatch(/\brequire\s*\(/);

    const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');
    expect(main).toContain('requestAnimationFrame');
    expect(main).toMatch(/WIDTH|HEIGHT/);
    expect(main).not.toMatch(/const WIDTH = 240/);
    expect(main).not.toMatch(/\brequire\s*\(/);
    expect(main).toContain('step(grid)');
    expect(main).toContain('renderer.draw()');
    expect(main).toMatch(/STARTER/);
    expect(main).toMatch(/TRANSMUTED/);
    expect(main).toMatch(/discovered/);
    expect(main).toMatch(/brushRadius|BRUSH|radius/);
    expect(main).toMatch(/clear\(/);
    expect(main).toMatch(/seedVessel/);
    expect(main).toMatch(/paintLine/);
    expect(main).toMatch(/paused/);
    expect(main).toMatch(/button === 2/);
    expect(main).toMatch(/showProbe/);
    expect(main).toMatch(/eyedrop/);
    expect(main).toMatch(/createRite|titleClick|gold-rain|nigredo/);
    expect(main).toMatch(/codex|#codex/);
    expect(html).toMatch(/id="codex"/);
    expect(html).toMatch(/id="viewport"/);
    expect(html).toMatch(/id="probe"/);
    expect(html).toMatch(/id="curtain"/);
    expect(html).toMatch(/id="hud"/);
    expect(html).toMatch(/id="still"/);
    expect(html).toMatch(/id="folio"/);
    expect(main).toMatch(/paintFolio|stained\(/);
    expect(main).toMatch(/zoomAt|wheel|panBy/);
    expect(main).toMatch(/probe|#probe/);
    expect(main).toMatch(/consumeBlast/);

    const stage = readFileSync(new URL('./stage.ts', import.meta.url), 'utf8');
    expect(stage).toMatch(/from ['"]three['"]/);
    expect(stage).toMatch(/ShaderMaterial|DataTexture/);
    expect(stage).toMatch(/uWonder|caustic|heat/);
    expect(stage).toMatch(/uShake/);
    expect(stage).toMatch(/NearestFilter/);
    expect(stage).toMatch(/setSize\(this\.grid\.width,\s*this\.grid\.height/);
    expect(stage).not.toMatch(/desynchronized:\s*true/);
    expect(html).toMatch(/rel="manifest"/);
    expect(html).toMatch(/theme-color/);
  });

  it('fits the vessel with the toolbar in one window instead of filling the view', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toMatch(/100dvh/);
    expect(html).toMatch(/container-type:\s*size/);
    expect(html).toMatch(/100cqh/);
    expect(html).toMatch(/100cqw/);
    expect(html).toMatch(/body\s*\{[^}]*overflow:\s*hidden/s);
  });
});
