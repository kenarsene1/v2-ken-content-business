import { describe, expect, it } from 'vitest';
import { forecast, projectionHistory } from '@/lib/revenue-projection';
const entry = { id:'1', title:'Ad income', kind:'income', source:'adsense', amount:100, currency:'USD', entry_date:'2026-09-01', account_id:null };
describe('revenue projector', () => {
  it('excludes expenses, incomplete months and other currencies', () => {
    const h = projectionHistory([entry, {...entry, kind:'expense'}, {...entry, currency:'EUR'}, {...entry, entry_date:'2026-10-01'}], [{stage:'published', publish_at:'2026-09-01', due_date:null}], '2026-10','USD','2026-10');
    expect(h.income).toHaveLength(1); expect(h.rows[0]?.rate).toBe(100);
    expect(forecast(h.rows,{adsense:3}).expected).toBe(300);
  });
  it('does not invent unit rates without published video history', () => {
    expect(projectionHistory([entry],[],'2026-10','USD','2026-10').rows[0]?.rate).toBe(0);
    expect(forecast([],{}).expected).toBe(0);
  });
  it('uses payments not invented product sales', () => {
    const h = projectionHistory([{...entry,source:'products'}],[],'2026-10','USD','2026-10');
    expect(h.rows[0]?.unitLabel).toBe('income payments');
  });
  it('ignores an incomplete current month in future forecasts',()=>{
    const h=projectionHistory([entry,{...entry,entry_date:'2026-10-02',amount:900}],[],'2026-11','USD','2026-10');
    expect(h.income).toHaveLength(1);expect(h.months).toBe(1);
  });
});