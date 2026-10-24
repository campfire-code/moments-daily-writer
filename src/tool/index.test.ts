import { describe, expect, it } from 'vitest';
import tool from './index';
import { readSheets } from './xlsx';
import type { InputItem, ItemResult, Params, RunContext } from '../kit/types';

type Llm = RunContext['llm'];
function fakeCtx(files: Map<string, Uint8Array>, params: Params, llm: Llm): RunContext {
  return {
    params, outputDir: '/out', signal: new AbortController().signal, progress: () => {},
    readFile: async (p) => files.get(p)!,
    readText: async (p) => new TextDecoder().decode(files.get(p)!),
    writeFile: async (p, d) => void files.set(p, d),
    writeText: async (p, t) => void files.set(p, new TextEncoder().encode(t)),
    mkdir: async () => {},
    join: async (...parts) => parts.join('/'),
    llm, sidecar: async () => '', ffmpeg: async () => {}, duration: async () => 0,
  };
}
const defaults = (over: Params): Params => ({ ...Object.fromEntries(tool.params.map((f) => [f.key, f.default])), ...over });

describe('完整流程', () => {
  it('按天数 × 条数生成，每条一次调用，导出排期表', async () => {
    const files = new Map<string, Uint8Array>();
    const prompts: string[] = [];
    const llm: Llm = async (m) => {
      prompts.push(m[1].content);
      const n = prompts.length;
      return n % 2 ? `\`\`\`json\n{"copy":"第${n}条正文","image":"拍桌面","comment":"私信下单"}\n\`\`\`` : `{"文案":"第${n}条正文","配图":["图一","图二"],"首评":"评论区见"}`;
    };
    const ctx = fakeCtx(files, defaults({ info: '保温杯', days: 3, perDay: 2, start: '2026-11-09', style: 'promo' }), llm);
    expect(tool.count!(ctx.params)).toBe(6);
    const results: { item: InputItem; result: ItemResult }[] = [];
    for (let i = 5; i >= 0; i--) results.push({ item: { id: `g_${i}`, name: `第 ${i + 1} 条` }, result: await tool.generate(i, ctx) });
    expect(prompts).toHaveLength(6);
    expect(results[5].result.text).toMatch(/^11月9日 周一 · 早上 7:30–8:30 · 促销活动 · 双十一预热\n\n第6条正文\n\n【配图】图一；图二\n【首评】评论区见$/);
    const msg = await tool.afterAll!(results, ctx);
    expect(msg).toBe('排期表已保存：/out/朋友圈排期-2026-11-09起3天.xlsx');
    const [s] = await readSheets(files.get('/out/朋友圈排期-2026-11-09起3天.xlsx')!, 'x.xlsx');
    expect(s.grid).toHaveLength(7);
    expect(s.grid[1].slice(0, 4)).toEqual([1, '2026-11-09', '周一', '早上 7:30–8:30']);
    expect(s.grid[6].slice(0, 2)).toEqual([6, '2026-11-11']);
    expect(s.grid[6][6]).toBe('双十一');
  });

  it('解析失败会重试一次', async () => {
    let n = 0;
    const llm: Llm = async () => (++n === 1 ? '{"comment":"只有首评"}' : '{"copy":"正文"}');
    const r = await tool.generate(0, fakeCtx(new Map(), defaults({ info: '杯子' }), llm));
    expect(n).toBe(2);
    expect(r.text).toContain('正文');
  });

  it('没填商品信息、日期写错、没配置大模型时给出清楚原因', async () => {
    const ok: Llm = async () => '{"copy":"x"}';
    await expect(tool.generate(0, fakeCtx(new Map(), defaults({}), ok))).rejects.toThrow('先在「商品 / 品牌信息」里写上');
    await expect(tool.generate(0, fakeCtx(new Map(), defaults({ info: 'a', start: '下周' }), ok))).rejects.toThrow('认不出来');
    const none: Llm = async () => { throw new Error('还没有设置大模型：请到「设置」里填写接口地址、密钥和模型名'); };
    await expect(tool.generate(0, fakeCtx(new Map(), defaults({ info: 'a' }), none))).rejects.toThrow('还没有设置大模型');
  });

  it('天数和条数超出范围时按上限算', () => {
    expect(tool.count!(defaults({ days: 99, perDay: 9 }))).toBe(90);
    expect(tool.count!(defaults({ days: 0, perDay: 0 }))).toBe(7);
  });
});
