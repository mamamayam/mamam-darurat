import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import BottomNav from './BottomNav';

const render = (pendingCount) => renderToString(<BottomNav currentView="beranda" navigate={() => {}} onOpenMenu={() => {}} pendingCount={pendingCount} />);

describe('BottomNav — badge persetujuan', () => {
  it('ada pengajuan: badge di ikon Beranda DAN Menu (tile Persetujuan ada di menu)', () => {
    const html = render(3);
    expect(html).toContain('data-testid="badge-pengajuan"');
    expect(html).toContain('data-testid="badge-menu"');
    expect(html).toContain('Menu, 3 pengajuan menunggu persetujuan');
  });
  it('tanpa pengajuan: tidak ada badge; lebih dari 9 jadi 9+', () => {
    expect(render(0)).not.toContain('badge-');
    expect(render(12)).toContain('9+');
  });
});
