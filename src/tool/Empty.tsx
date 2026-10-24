// 空状态：画出「一段商品信息 → 大模型 → 一周的朋友圈日历」，示例用真实感的中文
import { Settings2 } from 'lucide-react';
import './tool.css';

const DAYS: [string, string, string][] = [['9', '周一', '种草'], ['10', '周二', '日常'], ['11', '周三', '双十一'], ['12', '周四', '促销'], ['13', '周五', '种草'], ['14', '周六', '日常'], ['15', '周日', '种草']];

export function Empty({ hover }: { hover: boolean }) {
  return (
    <div className={`mm-empty${hover ? ' hover' : ''}`}>
      <svg viewBox="0 0 600 220" role="img" aria-label="一段商品信息交给大模型，排成一周的朋友圈文案日历">
        <rect x="6" y="30" width="150" height="130" rx="10" className="mm-e-card" />
        <text x="18" y="52" className="mm-e-k">商品信息</text>
        <text x="18" y="76" className="mm-e-v">316 保温杯 500 毫升</text>
        <text x="18" y="98" className="mm-e-v">89 元两个包邮</text>
        <text x="18" y="120" className="mm-e-v">本周送杯套</text>
        <text x="18" y="142" className="mm-e-v">客户是上班族</text>
        <path d="M164 95 H196 M188 87 L198 95 L188 103" className="mm-e-arrow" />
        <rect x="204" y="58" width="76" height="74" rx="10" className="mm-e-step" />
        <text x="242" y="88" textAnchor="middle" className="mm-e-st1">大模型</text>
        <text x="242" y="108" textAnchor="middle" className="mm-e-st2">写文案</text>
        <text x="242" y="124" textAnchor="middle" className="mm-e-st2">配首评</text>
        <path d="M288 95 H312 M304 87 L314 95 L304 103" className="mm-e-arrow" />
        {DAYS.map(([d, w, s], i) => (
          <g key={d} transform={`translate(${322 + (i % 4) * 68} ${i < 4 ? 20 : 112})`}>
            <rect width="62" height="84" rx="8" className={`mm-e-day${s === '双十一' ? ' hot' : ''}`} />
            <text x="31" y="34" textAnchor="middle" className="mm-e-d">{d}</text>
            <text x="31" y="50" textAnchor="middle" className="mm-e-w">{w}</text>
            <text x="31" y="72" textAnchor="middle" className="mm-e-s">{s}</text>
          </g>
        ))}
      </svg>
      <b className="mm-e-title">把商品信息，排成一周不重样的朋友圈</b>
      <span className="mm-e-sub">点右上角「参数」写好商品信息，选风格和天数，再点底部「生成文案」。每天一条动态：正文、配图建议、评论区首评，遇到节日自动预热。</span>
      <span className="mm-e-act"><Settings2 size={15} />只生成文案和排期表，发布由你自己手动完成</span>
    </div>
  );
}
