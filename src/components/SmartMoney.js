'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Term, TermText } from './Tooltip'

// Accent colors for each source
const SOURCE_COLORS = {
  congress: { main: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' },
  insider: { main: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.3)' },
  hedgeFund: { main: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)' },
  pe: { main: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)' },
}

const SOURCE_ICONS = {
  congress: '\u{1F3DB}',
  insider: '\u{1F464}',
  hedgeFund: '\u{1F4CA}',
  pe: '\u{1F3E2}',
}

const SOURCE_LABELS = {
  congress: 'Politicians',
  insider: 'Insiders',
  hedgeFund: 'Hedge Funds',
  pe: 'Deal Flow / M&A',
}

const PARTY_COLORS = {
  Democrat: '#60a5fa',
  D: '#60a5fa',
  Republican: '#f87171',
  R: '#f87171',
  Independent: '#a78bfa',
  I: '#a78bfa',
}

const STYLE_COLORS = {
  value: '#22c55e',
  growth: '#3b82f6',
  quant: '#a78bfa',
  macro: '#f59e0b',
  activist: '#ef4444',
  'multi-strategy': '#06b6d4',
  'event-driven': '#ec4899',
  'tech-growth': '#8b5cf6',
  'long-short': '#14b8a6',
}

const ROLE_BADGES = {
  'c-suite': { label: 'C-Suite', color: '#f59e0b' },
  'vp': { label: 'VP', color: '#8b5cf6' },
  'director': { label: 'Director', color: '#06b6d4' },
  '10pct-owner': { label: '10%+ Owner', color: '#ec4899' },
  'officer': { label: 'Officer', color: '#64748b' },
}

const QUICK_SCAN = [
  'NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA',
  'RTX', 'LMT', 'XOM', 'JPM', 'COIN', 'ARKK',
]

// ============================================================
// SPECULATIVE REASONING ENGINE
// Generates intelligent hypotheses for WHY a trade happened
// ============================================================

function speculateInsiderReason(trade, symbol, sector) {
  const { type, roleCategory, title, isOpenMarket, isDeriv, shares, value, ownershipPctChange, name } = trade
  const isBuy = ['buy', 'exercise-buy', 'deriv-buy'].includes(type)
  const isSell = ['sell', 'exercise-sell', 'deriv-sell', 'tax-withhold'].includes(type)
  const role = (title || '').toLowerCase()

  if (type === 'tax-withhold') {
    return `Shares withheld to cover tax obligations on vesting equity. This is a routine, non-discretionary transaction — not a signal of sentiment. ${name} retains the remaining shares, which may indicate confidence in the stock.`
  }
  if (type === 'award' || type === 'deriv-award') {
    return `Equity compensation awarded as part of ${name}'s executive package. New RSU/option grants often coincide with annual compensation cycles or performance milestones. Watch for subsequent sales within 90 days — holding signals confidence, quick selling may indicate a desire to de-risk.`
  }
  if (type === 'exercise-buy' || type === 'exercise-sell') {
    const nearExpiry = trade.expirationDate && new Date(trade.expirationDate) < new Date(Date.now() + 90 * 86400000)
    if (nearExpiry) {
      return `Option exercise near expiration date — likely a use-it-or-lose-it decision rather than a directional bet. The ${ownershipPctChange > 10 ? 'significant' : 'modest'} ownership change (${ownershipPctChange}%) suggests ${ownershipPctChange > 10 ? 'material position building' : 'routine vesting conversion'}.`
    }
    return `Early option exercise ${isBuy ? 'converting derivative to common shares' : 'disposing of vested options'}. ${isBuy && ownershipPctChange > 5 ? 'Increasing direct ownership stake may signal conviction in upcoming catalysts.' : 'May indicate portfolio rebalancing or liquidity needs.'}`
  }
  if (type === 'buy' && isOpenMarket) {
    const conviction = value > 1000000 ? 'high-conviction' : value > 100000 ? 'meaningful' : 'modest'
    const roleSignal = roleCategory === 'c-suite'
      ? `As ${title}, ${name} has deep visibility into ${symbol}'s pipeline, financials, and strategy.`
      : roleCategory === 'director'
      ? `Board members have access to strategic plans, M&A discussions, and non-public financial data.`
      : roleCategory === '10pct-owner'
      ? `As a 10%+ owner, this buyer has significant skin in the game and likely deep due diligence.`
      : `${name} may have operational insight into ${symbol}'s near-term trajectory.`
    const sectorContext = sector === 'defense' ? 'Upcoming defense budget votes or contract announcements could be driving this conviction.'
      : sector === 'pharma' ? 'Could signal confidence ahead of FDA decisions, trial data, or pipeline catalysts.'
      : sector === 'tech' ? 'May reflect insider knowledge of product launches, earnings trajectory, or partnership deals.'
      : sector === 'energy' ? 'Energy insiders often buy ahead of commodity price inflections or regulatory changes.'
      : 'Open-market purchases with personal capital are the strongest form of insider conviction.'
    return `${conviction[0].toUpperCase() + conviction.slice(1)} open-market purchase using personal funds — the most meaningful insider signal. ${roleSignal} ${sectorContext}${ownershipPctChange > 5 ? ` Position increased by ${ownershipPctChange}%, further concentrating their exposure.` : ''}`
  }
  if (type === 'sell' && isOpenMarket) {
    const large = value > 1000000
    return `Open-market sale${large ? ` of $${value >= 1e6 ? (value / 1e6).toFixed(1) + 'M' : (value / 1e3).toFixed(0) + 'K'}` : ''}. ${roleCategory === 'c-suite' ? 'C-suite selling can indicate overvaluation concerns, planned diversification, or liquidity needs (home purchase, divorce, etc.).' : 'Could be pre-planned 10b5-1 selling, tax optimization, or genuine concern about near-term performance.'} ${large ? 'The size of this sale warrants attention — monitor for follow-up selling from other insiders.' : 'Isolated insider sales are common and often routine.'}`
  }
  if (isDeriv) {
    return `Derivative transaction involving ${trade.security || 'options/warrants'}. ${trade.exercisePrice ? `Exercise price: $${trade.exercisePrice}` : ''} ${trade.underlyingSecurity ? `Underlying: ${trade.underlyingSecurity}` : ''}. Derivative activity reflects compensation mechanics more than directional sentiment unless accompanied by open-market activity.`
  }
  return `${name} (${title || 'Insider'}) executed a ${type} transaction. Context-dependent — evaluate alongside other insider activity and the broader market environment.`
}

function speculateCongressReason(trade, symbol, sector) {
  const { politician, party, state, type, amount, disclosureLag, stockActViolation, owner, chamber } = trade
  const isBuy = type === 'buy'
  const partyLabel = party === 'Democrat' || party === 'D' ? 'Democrat' : party === 'Republican' || party === 'R' ? 'Republican' : party || 'Unknown'

  let reasoning = ''

  if (stockActViolation) {
    reasoning += `Late STOCK Act disclosure (${disclosureLag} days vs 45-day requirement). Late filings have historically preceded significant price moves, as they may indicate trades made with non-public legislative information. `
  }

  if (owner && owner !== 'Self') {
    reasoning += `Trade made by ${politician}'s ${owner.toLowerCase()}, not the member directly. Spousal/family trades still reflect household conviction and potential information flow. `
  }

  const committeeContext = sector === 'defense'
    ? `${partyLabel} members on Armed Services or Appropriations committees have direct visibility into defense contract decisions.`
    : sector === 'pharma'
    ? `Members on Health or Commerce committees may have advance knowledge of FDA regulatory changes or drug pricing legislation.`
    : sector === 'tech'
    ? `Members on Commerce, Science, or Intelligence committees may have insight into tech regulation, antitrust actions, or government contracts.`
    : sector === 'finance'
    ? `Members on Banking or Financial Services committees influence financial regulation and monetary policy.`
    : sector === 'energy'
    ? `Members on Energy or Environment committees shape energy policy, subsidies, and drilling regulations.`
    : `Congressional ${isBuy ? 'buying' : 'selling'} activity may reflect legislative awareness or constituent briefings.`

  reasoning += isBuy
    ? `${politician} (${partyLabel}${state ? `-${state}` : ''}) purchasing ${symbol}. ${committeeContext} Congressional ${isBuy ? 'buy' : 'sell'} signals have shown statistically significant alpha in academic studies.`
    : `${politician} (${partyLabel}${state ? `-${state}` : ''}) selling ${symbol}. ${committeeContext} This could be portfolio rebalancing, but congressional sell timing has historically shown market awareness.`

  if (amount && amount !== 'Unknown') {
    reasoning += ` Trade size: ${amount}.`
  }

  return reasoning
}

function speculateDealFlowReason(deal) {
  const { firm, target, type, label, filingType, significance } = deal

  if (type === '13D-activist') {
    return `${firm} filed Schedule 13D disclosing a >5% activist stake with intent to influence management. Activist investors typically push for board seats, strategic reviews, spin-offs, buybacks, or outright sales. ${target ? `Target: ${target}.` : ''} 13D filings are among the strongest catalysts for share price appreciation — historically generating 7-10% abnormal returns in the 20 days following disclosure.`
  }
  if (type === '13G-passive') {
    return `${firm} disclosed a passive >5% stake via Schedule 13G. While classified as "passive," large institutional ownership often precedes strategic changes. The threshold crossing itself signals deep due diligence and long-term conviction. ${firm.includes('Berkshire') || firm.includes('Vanguard') ? 'This filer is known for patient, value-oriented positions.' : ''} Watch for potential 13G→13D amendment if the holder becomes activist.`
  }
  if (filingType?.includes('DEFM14A')) {
    return `Definitive merger proxy filed — shareholders are being asked to vote on a completed deal. ${target ? `Target: ${target}.` : ''} This is a late-stage M&A signal indicating the transaction is moving toward closing. The spread between current price and deal price represents potential merger arbitrage opportunity.`
  }
  if (filingType?.includes('PREM14A')) {
    return `Preliminary merger proxy filed — early-stage M&A disclosure. ${target ? `Target company: ${target}.` : ''} Deal terms are still being finalized and shareholder vote has not yet occurred. Risk of deal collapse is higher at this stage, but the premium typically offers significant upside if completed.`
  }
  if (filingType?.includes('SC TO')) {
    return `Tender offer filed — ${firm} is making a direct bid to shareholders. Tender offers typically come at a premium to market price and represent the most concrete form of acquisition intent. Watch for competing bids, which could drive the price higher.`
  }
  if (filingType?.includes('S-4')) {
    return `Merger registration statement (S-4) filed with the SEC — ${firm} is registering securities for a stock-for-stock merger. ${target ? `Target: ${target}.` : ''} This filing indicates the deal is progressing through regulatory channels. The exchange ratio determines value — monitor for SEC comment letters that could delay or modify terms.`
  }
  if (filingType?.includes('SC 13E-3')) {
    return `Going-private transaction filed — ${firm} is taking the company private. This typically occurs at a significant premium to public market price. Shareholders may receive a cash buyout or be squeezed out at the deal price. Very strong bullish catalyst.`
  }
  if (filingType?.includes('DEFA14A')) {
    return `Additional proxy materials filed by ${firm}. This supplemental disclosure often contains updated financial projections, fairness opinions, or management responses to shareholder concerns about a pending transaction.`
  }
  if (filingType?.includes('8-K')) {
    return `${firm} filed an 8-K with M&A keywords — likely announcing an acquisition, definitive agreement, or business combination. 8-K filings are current event reports and represent real-time corporate action disclosure.`
  }
  return `${firm} filed ${filingType || 'an SEC filing'} related to deal activity. ${target ? `Involves ${target}.` : ''} ${label || ''} — significance: ${significance || 'unknown'}. Monitor for follow-up filings that clarify deal terms and timeline.`
}

function speculateHedgeFundReason(holding) {
  const { holder, manager, style, changePct, dateReported, shares, value } = holding
  const hasChange = changePct && changePct !== '0' && parseFloat(changePct) !== 0
  const increasing = hasChange && parseFloat(changePct) > 0

  const styleContext = style === 'value' ? 'Value investors like this fund buy when they believe intrinsic value significantly exceeds market price — they have typically done extensive fundamental analysis.'
    : style === 'activist' ? 'Activist funds take large positions to push for corporate changes (board seats, spin-offs, buybacks). Their involvement often precedes significant price catalysts.'
    : style === 'quant' ? 'Quantitative funds use algorithmic models to identify statistical mispricings. Their positioning reflects systematic factor analysis rather than fundamental conviction.'
    : style === 'growth' ? 'Growth-oriented funds focus on revenue acceleration and TAM expansion. Their inclusion signals they see significant top-line growth potential.'
    : style === 'macro' ? 'Macro funds position based on global economic themes (rates, currencies, geopolitics). Their allocation reflects a broader macro thesis about the sector.'
    : style === 'multi-strategy' ? 'Multi-strategy funds allocate across various approaches. Their position may reflect market-neutral hedging, event arbitrage, or directional conviction.'
    : style === 'event-driven' ? 'Event-driven funds position around corporate catalysts (M&A, restructuring, spin-offs). Their involvement may signal an anticipated corporate action.'
    : style === 'long-short' ? 'Long-short funds pair positions — this holding represents their long conviction. Their fundamental analysis typically involves deep industry expertise.'
    : 'Institutional ownership reflects professional capital allocation based on research and due diligence.'

  if (manager) {
    return `${holder} (${manager}) holds a position in this security${hasChange ? (increasing ? `, increased by ${changePct}%` : `, reduced by ${Math.abs(parseFloat(changePct))}%`) : ''}. ${styleContext}${dateReported ? ` Filing date: ${dateReported.slice(0, 10)} — note that 13F data has a 45-day reporting lag.` : ''}`
  }
  return `${holder} holds a position. ${styleContext}${dateReported ? ` As of ${dateReported.slice(0, 10)}.` : ''}`
}

// ---- Hover Tooltip Component ----
function TradeTooltip({ children, reason }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef(null)

  if (!reason) return children

  const handleMouseEnter = () => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const tooltipWidth = 340
    let left = rect.left + rect.width / 2
    if (left + tooltipWidth / 2 > window.innerWidth - 12) left = window.innerWidth - tooltipWidth / 2 - 12
    if (left - tooltipWidth / 2 < 12) left = tooltipWidth / 2 + 12
    setPos({ top: rect.top - 8, left })
    setShow(true)
  }

  return (
    <div ref={ref} onMouseEnter={handleMouseEnter} onMouseLeave={() => setShow(false)} style={{ position: 'relative' }}>
      {children}
      {show && (
        <div style={{
          position: 'fixed', zIndex: 200,
          top: pos.top, left: pos.left,
          transform: 'translate(-50%, -100%)',
          maxWidth: 340, padding: '10px 14px', borderRadius: 10,
          fontSize: 11, lineHeight: 1.55, color: 'rgb(var(--nx-text-primary))',
          background: 'rgb(var(--nx-elevated, 30 30 35))',
          border: '1px solid rgba(var(--nx-text-muted), 0.15)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          pointerEvents: 'none',
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgb(var(--nx-accent))', marginBottom: 4 }}>
            Speculated Reasoning
          </div>
          {reason}
          <div style={{
            position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
            borderTop: '6px solid rgba(var(--nx-text-muted), 0.15)',
          }} />
        </div>
      )}
    </div>
  )
}

// ---- Shared UI atoms ----

function Badge({ children, color, bg }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap',
      background: bg || `${color}22`, color: color || 'rgb(var(--nx-text-muted))',
      border: `1px solid ${color || 'rgba(var(--nx-text-muted), 0.2)'}33`,
    }}>
      {children}
    </span>
  )
}

function TypeBadge({ type }) {
  const isBuy = ['buy', 'exercise-buy', 'deriv-buy'].includes(type)
  const isSell = ['sell', 'exercise-sell', 'deriv-sell', 'tax-withhold'].includes(type)
  const label = type === 'exercise-buy' ? 'EXERCISE' : type === 'exercise-sell' ? 'EX-SELL'
    : type === 'tax-withhold' ? 'TAX' : type === 'award' ? 'AWARD'
    : type === 'deriv-buy' ? 'D-BUY' : type === 'deriv-sell' ? 'D-SELL'
    : type === 'deriv-award' ? 'D-AWARD' : type === 'conversion' ? 'CONVERT'
    : type?.toUpperCase() || '?'
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
      background: isBuy ? 'rgba(var(--nx-green), 0.15)' : isSell ? 'rgba(var(--nx-red), 0.15)' : 'rgba(var(--nx-text-muted), 0.1)',
      color: isBuy ? 'rgb(var(--nx-green))' : isSell ? 'rgb(var(--nx-red))' : 'rgb(var(--nx-text-muted))',
    }}>{label}</span>
  )
}

function SentimentBar({ value, label }) {
  const pct = Math.abs(value)
  const isPositive = value >= 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ width: 80, flexShrink: 0, color: 'rgb(var(--nx-text-muted))', textAlign: 'right', fontSize: 11 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: 'rgba(var(--nx-text-muted), 0.1)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(var(--nx-text-muted), 0.3)' }} />
        <div style={{
          position: 'absolute', top: 0, bottom: 0, borderRadius: 4,
          ...(isPositive
            ? { left: '50%', width: `${pct / 2}%`, background: 'rgb(var(--nx-green))' }
            : { right: '50%', width: `${pct / 2}%`, background: 'rgb(var(--nx-red))' }
          ),
        }} />
      </div>
      <span style={{
        width: 45, textAlign: 'right', fontWeight: 600,
        color: value > 10 ? 'rgb(var(--nx-green))' : value < -10 ? 'rgb(var(--nx-red))' : 'rgb(var(--nx-text-muted))',
      }}>
        {value > 0 ? '+' : ''}{value}%
      </span>
    </div>
  )
}

function InfluenceRing({ sources, composite, dominant }) {
  const radius = 60
  const strokeWidth = 12
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto' }}>
      <svg width={160} height={160} viewBox="0 0 160 160">
        {sources.map((s) => {
          const color = SOURCE_COLORS[s.source]?.main || '#666'
          const pct = s.effectiveWeight / (sources.reduce((a, x) => a + x.effectiveWeight, 0) || 1)
          const dashLength = circumference * pct
          const dashGap = circumference - dashLength
          const rotation = (offset / circumference) * 360 - 90
          offset += dashLength
          return (
            <circle
              key={s.source} cx={80} cy={80} r={radius} fill="none"
              stroke={color} strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${dashGap}`}
              strokeLinecap="round"
              transform={`rotate(${rotation} 80 80)`}
              style={{ opacity: s.activity > 20 ? 1 : 0.4, transition: 'all 0.5s' }}
            />
          )
        })}
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
        <div style={{
          fontSize: 28, fontWeight: 700,
          color: composite > 10 ? 'rgb(var(--nx-green))' : composite < -10 ? 'rgb(var(--nx-red))' : 'rgb(var(--nx-text-primary))',
        }}>
          {composite > 0 ? '+' : ''}{composite}
        </div>
        <div style={{ fontSize: 10, color: 'rgb(var(--nx-text-muted))', textTransform: 'uppercase', letterSpacing: 1 }}>
          composite
        </div>
      </div>
    </div>
  )
}

// ---- Expanded Detail Panels ----

function CongressDetail({ data, symbol, sector }) {
  const trades = data?.congress?.trades || []
  const summary = data?.congress?.summary || {}
  const pb = summary.partyBreakdown || {}

  return (
    <div>
      {/* Party breakdown bar */}
      {(pb.democrat || pb.republican) && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'rgb(var(--nx-text-muted))', marginBottom: 4 }}>
            Party Breakdown
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
            <span style={{ color: PARTY_COLORS.Democrat }}>
              D: {pb.democrat?.buys || 0} buys / {pb.democrat?.sells || 0} sells
            </span>
            <span style={{ color: PARTY_COLORS.Republican }}>
              R: {pb.republican?.buys || 0} buys / {pb.republican?.sells || 0} sells
            </span>
          </div>
          {summary.bipartisan && (
            <Badge color="#a78bfa">Bipartisan Signal</Badge>
          )}
        </div>
      )}

      {/* STOCK Act violations */}
      {summary.stockActViolations > 0 && (
        <div style={{
          marginBottom: 10, padding: '6px 10px', borderRadius: 6,
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
          fontSize: 11, color: '#f87171', fontWeight: 600,
        }}>
          {summary.stockActViolations} STOCK Act Violation{summary.stockActViolations > 1 ? 's' : ''} Detected (Disclosure &gt;45 days)
        </div>
      )}

      {/* Trade list */}
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {trades.slice(0, 12).map((t, i) => (
          <TradeTooltip key={i} reason={speculateCongressReason(t, symbol, sector)}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: '1px solid rgba(var(--nx-text-muted), 0.05)', fontSize: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: 'rgb(var(--nx-text-primary))' }}>{t.politician}</span>
                  {t.party && (
                    <span style={{ color: PARTY_COLORS[t.party] || '#999', fontSize: 11 }}>
                      ({t.party?.[0]}{t.state ? `-${t.state}` : ''})
                    </span>
                  )}
                  {t.owner && t.owner !== 'Self' && (
                    <Badge color="#94a3b8">{t.owner}</Badge>
                  )}
                  {t.stockActViolation && (
                    <Badge color="#ef4444">Late Disclosure</Badge>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <TypeBadge type={t.type} />
                <span style={{ color: 'rgb(var(--nx-text-muted))', minWidth: 80, textAlign: 'right' }}>{t.amount}</span>
                <span style={{ color: 'rgb(var(--nx-text-muted))', fontSize: 11, minWidth: 72 }}>
                  {t.date?.slice(0, 10)}
                </span>
                {t.disclosureLag != null && (
                  <span style={{
                    fontSize: 10, color: t.disclosureLag > 45 ? '#f87171' : 'rgb(var(--nx-text-muted))',
                    fontWeight: t.disclosureLag > 45 ? 700 : 400,
                  }}>
                    {t.disclosureLag}d lag
                  </span>
                )}
              </div>
            </div>
          </TradeTooltip>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 11, color: 'rgb(var(--nx-text-muted))' }}>
        <span>{summary.uniquePoliticians || 0} politicians</span>
        <span>{summary.totalTrades || 0} trades</span>
      </div>
    </div>
  )
}

function InsiderDetail({ data, symbol, sector }) {
  const trades = data?.insider?.trades || []
  const summary = data?.insider?.summary || {}

  return (
    <div>
      {/* Signal badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {summary.clusterBuy && <Badge color="#22c55e">Cluster Buy ({summary.uniqueInsiders}+ insiders)</Badge>}
        {summary.clusterSell && <Badge color="#ef4444">Cluster Sell</Badge>}
        {summary.cSuiteBuying && <Badge color="#f59e0b">C-Suite Buying</Badge>}
        {summary.cSuiteSelling && <Badge color="#ef4444">C-Suite Selling</Badge>}
        {summary.signalDirection?.includes('strong') && (
          <Badge color={summary.signalDirection.includes('bullish') ? '#22c55e' : '#ef4444'}>
            {summary.signalDirection.toUpperCase()}
          </Badge>
        )}
      </div>

      {/* Open market vs all summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11, color: 'rgb(var(--nx-text-muted))' }}>
        <span>Open Market: {summary.openMarketBuys || 0}B / {summary.openMarketSells || 0}S</span>
        <span>Buy: {summary.buyValue || '$0'}</span>
        <span>Sell: {summary.sellValue || '$0'}</span>
        <span>Net: <span style={{ fontWeight: 700, color: (summary.netValue || '').startsWith('-') ? 'rgb(var(--nx-red))' : 'rgb(var(--nx-green))' }}>{summary.netValue || '$0'}</span></span>
      </div>

      {/* Largest trade callout */}
      {summary.largestTrade && (
        <div style={{
          marginBottom: 8, padding: '6px 10px', borderRadius: 6,
          background: 'rgba(var(--nx-accent), 0.08)', border: '1px solid rgba(var(--nx-accent), 0.15)',
          fontSize: 11, display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span style={{ fontWeight: 700, color: 'rgb(var(--nx-accent))' }}>LARGEST</span>
          <span style={{ color: 'rgb(var(--nx-text-primary))' }}>{summary.largestTrade.name}</span>
          <TypeBadge type={summary.largestTrade.type} />
          <span style={{ color: 'rgb(var(--nx-text-muted))' }}>{summary.largestTrade.value}</span>
          <span style={{ color: 'rgb(var(--nx-text-muted))' }}>{summary.largestTrade.shares?.toLocaleString()} shares</span>
        </div>
      )}

      {/* Trade list */}
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {trades.slice(0, 12).map((t, i) => (
          <TradeTooltip key={i} reason={speculateInsiderReason(t, symbol, sector)}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: '1px solid rgba(var(--nx-text-muted), 0.05)', fontSize: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: 'rgb(var(--nx-text-primary))' }}>{t.name}</span>
                  {t.roleCategory && ROLE_BADGES[t.roleCategory] && (
                    <Badge color={ROLE_BADGES[t.roleCategory].color}>{ROLE_BADGES[t.roleCategory].label}</Badge>
                  )}
                  {t.isDeriv && <Badge color="#a78bfa">Derivative</Badge>}
                  {t.isOpenMarket && <Badge color="#22c55e">Open Mkt</Badge>}
                </div>
                {t.title && <div style={{ fontSize: 10, color: 'rgb(var(--nx-text-muted))', marginTop: 1 }}>{t.title}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <TypeBadge type={t.type} />
                <span style={{ color: 'rgb(var(--nx-text-muted))', fontSize: 11 }}>
                  {t.shares?.toLocaleString()} sh
                </span>
                {t.value > 0 && (
                  <span style={{ color: 'rgb(var(--nx-text-muted))', fontSize: 11 }}>
                    ${t.value >= 1e6 ? `${(t.value / 1e6).toFixed(1)}M` : t.value >= 1e3 ? `${(t.value / 1e3).toFixed(0)}K` : t.value}
                  </span>
                )}
                {t.ownershipPctChange > 0 && (
                  <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 700 }}>
                    {t.ownershipPctChange > 0 ? '+' : ''}{t.ownershipPctChange}%
                  </span>
                )}
                <span style={{ color: 'rgb(var(--nx-text-muted))', fontSize: 11, minWidth: 62 }}>
                  {t.date?.slice(0, 10)}
                </span>
              </div>
            </div>
          </TradeTooltip>
        ))}
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: 'rgb(var(--nx-text-muted))' }}>
        {summary.uniqueInsiders || 0} unique insiders &bull; {summary.totalTrades || 0} transactions &bull; Source: {summary.dataSource || 'SEC EDGAR'}
      </div>
    </div>
  )
}

function HedgeFundDetail({ data, symbol, sector }) {
  const notable = data?.hedgeFund?.notable || []
  const summary = data?.hedgeFund?.summary || {}

  return (
    <div>
      {/* Fund consensus & styles */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {summary.fundConsensus > 0 && (
          <Badge color="#06b6d4">
            {summary.fundConsensus} Notable Fund{summary.fundConsensus > 1 ? 's' : ''} Holding
          </Badge>
        )}
        {(summary.notableStyles || []).map(s => (
          <Badge key={s} color={STYLE_COLORS[s] || '#64748b'}>{s}</Badge>
        ))}
      </div>

      {/* Aggregate stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11, color: 'rgb(var(--nx-text-muted))' }}>
        <span>{summary.totalHolders || 0} holders</span>
        <span>Total: {summary.totalValue || '$0'}</span>
        <span>Shares: {summary.totalShares || '0'}</span>
        <span>Net: <span style={{ fontWeight: 700, color: summary.netFlow === 'accumulating' ? 'rgb(var(--nx-green))' : summary.netFlow === 'distributing' ? 'rgb(var(--nx-red))' : 'rgb(var(--nx-text-muted))' }}>{summary.netFlow}</span></span>
      </div>

      {/* Notable fund list */}
      {notable.length > 0 && (
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, color: SOURCE_COLORS.hedgeFund.main, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Notable Funds</div>
          {notable.slice(0, 10).map((h, i) => (
            <TradeTooltip key={i} reason={speculateHedgeFundReason(h)}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 0', borderBottom: '1px solid rgba(var(--nx-text-muted), 0.05)', fontSize: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, color: 'rgb(var(--nx-text-primary))' }}>{h.holder}</span>
                  {h.manager && <span style={{ fontSize: 10, color: 'rgb(var(--nx-text-muted))' }}>({h.manager})</span>}
                  {h.style && <Badge color={STYLE_COLORS[h.style] || '#64748b'}>{h.style}</Badge>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {h.shares > 0 && (
                    <span style={{ fontSize: 11, color: 'rgb(var(--nx-text-muted))' }}>
                      {h.shares > 1e6 ? `${(h.shares / 1e6).toFixed(1)}M` : h.shares > 1e3 ? `${(h.shares / 1e3).toFixed(0)}K` : h.shares} shares
                    </span>
                  )}
                  {h.changePct !== '0' && h.changePct !== 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: parseFloat(h.changePct) > 0 ? 'rgb(var(--nx-green))' : parseFloat(h.changePct) < 0 ? 'rgb(var(--nx-red))' : 'rgb(var(--nx-text-muted))',
                    }}>
                      {parseFloat(h.changePct) > 0 ? '+' : ''}{h.changePct}%
                    </span>
                  )}
                  {h.dateReported && (
                    <span style={{ fontSize: 10, color: 'rgb(var(--nx-text-muted))' }}>{h.dateReported.slice(0, 10)}</span>
                  )}
                </div>
              </div>
            </TradeTooltip>
          ))}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: 'rgb(var(--nx-text-muted))' }}>
        {summary.increasing || 0} increasing &bull; {summary.decreasing || 0} decreasing &bull; {summary.newPositions || 0} new
      </div>
    </div>
  )
}

function DealFlowDetail({ data, symbol, sector }) {
  const moves = data?.pe?.moves || []
  const summary = data?.pe?.summary || {}

  const sigColors = { high: '#ef4444', medium: '#f59e0b', low: '#64748b' }

  return (
    <div>
      {/* Known activists */}
      {(summary.knownActivists || []).length > 0 && (
        <div style={{
          marginBottom: 8, padding: '6px 10px', borderRadius: 6,
          background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)',
          fontSize: 11, color: '#f87171', fontWeight: 600,
        }}>
          Known Activist{summary.knownActivists.length > 1 ? 's' : ''}: {summary.knownActivists.join(', ')}
        </div>
      )}

      {/* Category breakdown */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {summary.activistStakes > 0 && <Badge color="#ef4444">{summary.activistStakes} Activist 13D</Badge>}
        {summary.passiveStakes > 0 && <Badge color="#f59e0b">{summary.passiveStakes} Passive 13G</Badge>}
        {summary.mnaActivity > 0 && <Badge color="#ec4899">{summary.mnaActivity} M&A Filing{summary.mnaActivity > 1 ? 's' : ''}</Badge>}
      </div>

      {/* Deal list */}
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {moves.slice(0, 12).map((m, i) => (
          <TradeTooltip key={i} reason={speculateDealFlowReason(m)}>
            <div style={{
              padding: '6px 0', borderBottom: '1px solid rgba(var(--nx-text-muted), 0.05)', fontSize: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: sigColors[m.significance] || '#64748b', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: 'rgb(var(--nx-text-primary))' }}>{m.firm}</span>
                  {m.target && (
                    <span style={{ fontSize: 10, color: 'rgb(var(--nx-text-muted))' }}>&rarr; {m.target}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <Badge color={sigColors[m.significance]}>{m.label}</Badge>
                  <span style={{ color: 'rgb(var(--nx-text-muted))', fontSize: 11 }}>{m.date?.slice(0, 10)}</span>
                </div>
              </div>
              {m.filingType && (
                <div style={{ fontSize: 10, color: 'rgb(var(--nx-text-muted))', marginTop: 2, marginLeft: 14 }}>
                  {m.filingType} — {m.description}
                </div>
              )}
            </div>
          </TradeTooltip>
        ))}
      </div>

      {moves.length === 0 && (
        <div style={{ fontSize: 12, color: 'rgb(var(--nx-text-muted))', textAlign: 'center', padding: 10 }}>
          No deal flow activity detected (365-day lookback)
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: 'rgb(var(--nx-text-muted))' }}>
        {summary.totalMoves || 0} total filings &bull; Source: {summary.dataSource || 'SEC EDGAR'}
      </div>
    </div>
  )
}

// ---- Source Card ----

function SourceCard({ source, data, symbol, sector, isExpanded, onToggle }) {
  const colors = SOURCE_COLORS[source] || SOURCE_COLORS.congress
  const icon = SOURCE_ICONS[source] || ''
  const label = SOURCE_LABELS[source] || source

  const summary = source === 'congress' ? data?.congress?.summary
    : source === 'insider' ? data?.insider?.summary
    : source === 'hedgeFund' ? data?.hedgeFund?.summary
    : data?.pe?.summary

  const influence = data?.influence?.sources?.find(s => s.source === source)
  const isDominant = data?.influence?.dominant?.source === source

  if (!summary) return null

  return (
    <div style={{
      background: isDominant ? colors.bg : 'rgba(var(--nx-text-muted), 0.03)',
      border: `1px solid ${isDominant ? colors.border : 'rgba(var(--nx-text-muted), 0.1)'}`,
      borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.2s',
    }} onClick={onToggle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'rgb(var(--nx-text-primary))' }}>{label}</span>
          {isDominant && <Badge color={colors.main}>Top Influence</Badge>}
          {/* Signal direction badge */}
          {summary.signalDirection && summary.signalDirection !== 'neutral' && (
            <Badge color={summary.signalDirection.includes('bullish') ? '#22c55e' : '#ef4444'}>
              {summary.signalDirection}
            </Badge>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 60, height: 6, background: 'rgba(var(--nx-text-muted), 0.1)', borderRadius: 3 }}>
            <div style={{
              width: `${influence?.weight || 0}%`, height: '100%', background: colors.main,
              borderRadius: 3, transition: 'width 0.5s',
            }} />
          </div>
          <span style={{ fontSize: 11, color: 'rgb(var(--nx-text-muted))', fontWeight: 600 }}>
            {influence?.weight || 0}%
          </span>
          <span style={{ fontSize: 14, color: 'rgb(var(--nx-text-muted))', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
            &#x25BE;
          </span>
        </div>
      </div>

      {/* Quick summary row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? 10 : 0 }}>
        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
          {summary.buys != null && (
            <span style={{ color: 'rgb(var(--nx-green))' }}>
              {summary.buys} {source === 'hedgeFund' ? 'accumulating' : 'buys'}
            </span>
          )}
          {summary.sells != null && (
            <span style={{ color: 'rgb(var(--nx-red))' }}>
              {summary.sells} {source === 'hedgeFund' ? 'trimming' : 'sells'}
            </span>
          )}
          {summary.increasing != null && source === 'hedgeFund' && (
            <>
              <span style={{ color: 'rgb(var(--nx-green))' }}>{summary.increasing} increasing</span>
              <span style={{ color: 'rgb(var(--nx-red))' }}>{summary.decreasing} decreasing</span>
            </>
          )}
          {summary.totalMoves != null && source === 'pe' && (
            <span>{summary.totalMoves} filings</span>
          )}
          {/* Insider-specific: open market count */}
          {source === 'insider' && summary.openMarketBuys != null && (
            <span style={{ color: 'rgb(var(--nx-text-muted))', fontSize: 11 }}>
              ({summary.openMarketBuys} open-mkt buys)
            </span>
          )}
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: (summary.sentiment || 0) > 10 ? 'rgb(var(--nx-green))'
            : (summary.sentiment || 0) < -10 ? 'rgb(var(--nx-red))'
            : 'rgb(var(--nx-text-muted))',
        }}>
          {summary.sentiment > 0 ? '+' : ''}{summary.sentiment || 0}%
        </span>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div style={{
          borderTop: '1px solid rgba(var(--nx-text-muted), 0.1)',
          paddingTop: 10, marginTop: 6,
        }} onClick={(e) => e.stopPropagation()}>
          {source === 'congress' && <CongressDetail data={data} symbol={symbol} sector={sector} />}
          {source === 'insider' && <InsiderDetail data={data} symbol={symbol} sector={sector} />}
          {source === 'hedgeFund' && <HedgeFundDetail data={data} symbol={symbol} sector={sector} />}
          {source === 'pe' && <DealFlowDetail data={data} symbol={symbol} sector={sector} />}
        </div>
      )}
    </div>
  )
}

// ---- Main Component ----

export default function SmartMoney({ quotes }) {
  const [symbol, setSymbol] = useState('NVDA')
  const [searchInput, setSearchInput] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedSource, setExpandedSource] = useState(null)
  const [scanResults, setScanResults] = useState([])
  const [scanning, setScanning] = useState(false)

  const fetchSmartMoney = useCallback(async (sym) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/smartmoney?symbol=${encodeURIComponent(sym)}`)
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
      const json = await res.json()
      setData(json)
      setSymbol(sym)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const runQuickScan = useCallback(async () => {
    setScanning(true)
    const results = []
    for (let i = 0; i < QUICK_SCAN.length; i += 3) {
      const batch = QUICK_SCAN.slice(i, i + 3)
      const batchResults = await Promise.allSettled(
        batch.map(async (sym) => {
          const res = await fetch(`/api/smartmoney?symbol=${sym}&mode=signal`)
          if (!res.ok) return null
          return res.json()
        })
      )
      batchResults.forEach(r => {
        if (r.status === 'fulfilled' && r.value) results.push(r.value)
      })
    }
    setScanResults(results.filter(Boolean).sort((a, b) =>
      Math.abs(b.influence?.composite || 0) - Math.abs(a.influence?.composite || 0)
    ))
    setScanning(false)
  }, [])

  useEffect(() => {
    fetchSmartMoney(symbol)
  }, []) // eslint-disable-line

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchInput.trim()) {
      fetchSmartMoney(searchInput.trim().toUpperCase())
      setSearchInput('')
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'rgb(var(--nx-text-primary))', margin: 0 }}>
            <Term term="Smart Money">Smart Money</Term> Tracker
          </h2>
          <p style={{ fontSize: 12, color: 'rgb(var(--nx-text-muted))', margin: '4px 0 0' }}>
            Track politicians, insiders, hedge funds &amp; deal flow — SEC EDGAR + FMP
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter ticker..."
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 13, width: 140,
                background: 'rgba(var(--nx-text-muted), 0.06)',
                border: '1px solid rgba(var(--nx-text-muted), 0.15)',
                color: 'rgb(var(--nx-text-primary))', outline: 'none',
              }}
            />
            <button type="submit" style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'rgb(var(--nx-accent))', color: '#fff', border: 'none', cursor: 'pointer',
            }}>
              Analyze
            </button>
          </form>
          <button onClick={runQuickScan} disabled={scanning} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'rgba(var(--nx-accent), 0.15)', color: 'rgb(var(--nx-accent))',
            border: '1px solid rgba(var(--nx-accent), 0.3)', cursor: 'pointer',
          }}>
            {scanning ? 'Scanning...' : 'Quick Scan All'}
          </button>
        </div>
      </div>

      {/* Quick ticker buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {QUICK_SCAN.map(sym => (
          <button
            key={sym}
            onClick={() => fetchSmartMoney(sym)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: sym === symbol ? 'rgb(var(--nx-accent))' : 'rgba(var(--nx-text-muted), 0.06)',
              color: sym === symbol ? '#fff' : 'rgb(var(--nx-text-muted))',
              border: `1px solid ${sym === symbol ? 'rgb(var(--nx-accent))' : 'rgba(var(--nx-text-muted), 0.1)'}`,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {sym}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgb(var(--nx-text-muted))' }}>
          Fetching smart money data for {symbol}...
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: 20, color: 'rgb(var(--nx-red))' }}>
          Error: {error}
        </div>
      )}

      {data && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
          {/* Left: Influence Ring & Composite Score */}
          <div>
            <div style={{
              background: 'rgba(var(--nx-text-muted), 0.03)',
              border: '1px solid rgba(var(--nx-text-muted), 0.1)',
              borderRadius: 16, padding: 20,
            }}>
              <div style={{ textAlign: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'rgb(var(--nx-text-primary))' }}>{symbol}</span>
                <span style={{
                  marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(var(--nx-accent), 0.12)', color: 'rgb(var(--nx-accent))',
                  fontWeight: 600, textTransform: 'uppercase',
                }}>
                  {data.sector}
                </span>
              </div>

              <InfluenceRing
                sources={data.influence?.sources || []}
                composite={data.influence?.composite || 0}
                dominant={data.influence?.dominant}
              />

              {/* Direction badge */}
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, padding: '4px 14px', borderRadius: 6,
                  background: data.influence?.direction === 'bullish' ? 'rgba(var(--nx-green), 0.15)'
                    : data.influence?.direction === 'bearish' ? 'rgba(var(--nx-red), 0.15)'
                    : 'rgba(var(--nx-text-muted), 0.1)',
                  color: data.influence?.direction === 'bullish' ? 'rgb(var(--nx-green))'
                    : data.influence?.direction === 'bearish' ? 'rgb(var(--nx-red))'
                    : 'rgb(var(--nx-text-muted))',
                }}>
                  {data.influence?.direction?.toUpperCase() || 'NEUTRAL'}
                </span>
                <div style={{ fontSize: 11, color: 'rgb(var(--nx-text-muted))', marginTop: 6 }}>
                  Data confidence: {data.influence?.confidence || 0}%
                </div>
              </div>

              {/* Dominant source callout */}
              {data.influence?.dominant && (
                <div style={{
                  marginTop: 14, padding: '10px 12px', borderRadius: 8,
                  background: SOURCE_COLORS[data.influence.dominant.source]?.bg,
                  border: `1px solid ${SOURCE_COLORS[data.influence.dominant.source]?.border}`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: SOURCE_COLORS[data.influence.dominant.source]?.main, marginBottom: 4 }}>
                    Dominant Influence
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgb(var(--nx-text-primary))' }}>
                    {SOURCE_ICONS[data.influence.dominant.source]} {data.influence.dominant.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgb(var(--nx-text-muted))', marginTop: 2 }}>
                    {data.influence.reason}
                  </div>
                </div>
              )}

              {/* Sentiment bars for each source */}
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.influence?.sources?.map(s => (
                  <SentimentBar key={s.source} value={s.sentiment} label={s.label} />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Source Detail Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['congress', 'insider', 'hedgeFund', 'pe'].map(source => (
              <SourceCard
                key={source}
                source={source}
                data={data}
                symbol={symbol}
                sector={data?.sector}
                isExpanded={expandedSource === source}
                onToggle={() => setExpandedSource(expandedSource === source ? null : source)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick Scan Results */}
      {scanResults.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'rgb(var(--nx-text-primary))', marginBottom: 12 }}>
            Smart Money Scan — Strongest Signals
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {scanResults.map(r => {
              const comp = r.influence?.composite || 0
              return (
                <div
                  key={r.symbol}
                  onClick={() => fetchSmartMoney(r.symbol)}
                  style={{
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(var(--nx-text-muted), 0.03)',
                    border: `1px solid ${Math.abs(comp) > 20 ? (comp > 0 ? 'rgba(var(--nx-green), 0.3)' : 'rgba(var(--nx-red), 0.3)') : 'rgba(var(--nx-text-muted), 0.1)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'rgb(var(--nx-text-primary))' }}>{r.symbol}</span>
                    <span style={{
                      fontWeight: 700, fontSize: 14,
                      color: comp > 10 ? 'rgb(var(--nx-green))' : comp < -10 ? 'rgb(var(--nx-red))' : 'rgb(var(--nx-text-muted))',
                    }}>
                      {comp > 0 ? '+' : ''}{comp}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgb(var(--nx-text-muted))', marginTop: 4 }}>
                    {SOURCE_ICONS[r.influence?.dominant?.source]} {r.influence?.dominant?.label} dominant
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, marginTop: 4,
                    color: r.influence?.direction === 'bullish' ? 'rgb(var(--nx-green))'
                      : r.influence?.direction === 'bearish' ? 'rgb(var(--nx-red))'
                      : 'rgb(var(--nx-text-muted))',
                  }}>
                    {r.influence?.direction?.toUpperCase()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
