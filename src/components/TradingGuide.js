'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

// ═══════════════════════════════════════════════════════════
//  NOCTIS TRADING ACADEMY — Interactive Options & Volatility Guide
//  Features: Adaptive pacing, Socratic questioning, interactive
//  modules, quizzes, historical data comparisons, worksheets
// ═══════════════════════════════════════════════════════════

// ─── Curriculum Structure ───
const CURRICULUM = [
  {
    id: 'foundations',
    title: 'Market Foundations',
    icon: '\u{1F3D7}',
    description: 'Core concepts every trader must master',
    modules: [
      {
        id: 'what-are-markets',
        title: 'What Are Financial Markets?',
        type: 'lesson',
        content: {
          sections: [
            {
              title: 'The Marketplace of Risk',
              body: 'Financial markets are simply organized venues where buyers and sellers exchange financial instruments — stocks, bonds, currencies, commodities, and derivatives. But beneath that simple definition lies something profound: markets are really about **pricing risk and time**.',
              keyInsight: 'Every trade is a bet about the future. When you buy a stock, you\'re saying "I believe this company will be worth more tomorrow than the market thinks today."',
              thinkAboutIt: 'If everyone agreed on what a stock was worth, would there be any trading? What does the existence of a "market price" actually tell us?',
            },
            {
              title: 'The Four Asset Classes',
              body: 'All financial instruments fall into four broad categories, each with unique characteristics:',
              points: [
                { term: 'Equities (Stocks)', def: 'Ownership shares in companies. Returns come from price appreciation + dividends. Risk: company can fail.' },
                { term: 'Fixed Income (Bonds)', def: 'Loans to governments or corporations. Returns come from interest payments. Risk: default, inflation eroding value.' },
                { term: 'Currencies (Forex)', def: 'Exchange rates between nations\' money. Always traded in pairs. Risk: central bank policy, geopolitics.' },
                { term: 'Commodities', def: 'Physical goods — gold, oil, wheat. Driven by supply/demand fundamentals. Risk: weather, geopolitics, substitution.' },
              ],
              thinkAboutIt: 'Gold is often called a "safe haven." But safe from what exactly? If inflation rises, why does gold tend to go up while bonds go down?',
            },
            {
              title: 'Derivatives: The Fifth Dimension',
              body: 'Derivatives are contracts whose value is **derived** from an underlying asset. Options, futures, and swaps are all derivatives. They don\'t represent ownership — they represent **rights, obligations, or agreements** about future prices.',
              keyInsight: 'Options are the most powerful derivative for retail traders because they let you define your exact risk before entering a trade. You can never lose more than you paid for an option.',
              thinkAboutIt: 'If you could buy insurance on your stock portfolio that pays out when prices fall, how much would you pay for it? That\'s essentially what a put option is.',
            },
          ],
        },
      },
      {
        id: 'supply-demand',
        title: 'Supply, Demand & Price Discovery',
        type: 'lesson',
        content: {
          sections: [
            {
              title: 'How Prices Are Born',
              body: 'Every price you see on a screen is the result of an **auction**. Buyers submit bids (maximum price they\'ll pay), sellers submit asks (minimum they\'ll accept). When a bid meets an ask, a trade occurs and a new price is established.',
              keyInsight: 'The "spread" between the bid and ask is the market maker\'s profit — and your cost of entry. Tight spreads mean liquid markets. Wide spreads mean be careful.',
              animation: 'orderbook',
            },
            {
              title: 'Volume: The Conviction Meter',
              body: 'Price tells you WHERE the market is. Volume tells you HOW MUCH conviction is behind that price. A price move on high volume is a signal. A price move on low volume is noise.',
              thinkAboutIt: 'If a stock drops 5% on 10x normal volume vs. 5% on 0.5x normal volume, which scenario is more concerning for a long position holder? Why?',
            },
          ],
        },
      },
      {
        id: 'foundations-quiz',
        title: 'Foundations Assessment',
        type: 'quiz',
        questions: [
          {
            q: 'A stock is trading at $100. The bid is $99.95 and the ask is $100.05. What is this difference called and what does it represent?',
            options: ['The spread — it\'s the market maker\'s compensation for providing liquidity', 'The margin — it\'s the profit on the stock', 'The premium — it\'s the cost of the option', 'The yield — it\'s the return on investment'],
            correct: 0,
            explanation: 'The bid-ask spread ($0.10 in this case) is the transaction cost you pay to enter/exit a position immediately. Market makers profit from this spread in exchange for always being willing to buy and sell.',
            followUp: 'Why do you think the spread on Apple stock is usually $0.01, but the spread on a penny stock might be $0.05 (which is a much larger percentage)?',
          },
          {
            q: 'A bond yields 5% while inflation is 3%. What is the "real" return and why does this matter?',
            options: ['8% — you add them together', '2% — your purchasing power grows by the difference', '5% — inflation doesn\'t affect bonds', '15% — you multiply them'],
            correct: 1,
            explanation: 'The real return is approximately nominal yield minus inflation (5% - 3% = 2%). This matters because if inflation exceeds the yield, you\'re actually losing purchasing power even though you\'re earning interest. This is why rising inflation crushes bond prices.',
            followUp: 'If the Fed signals it will raise rates to fight inflation, what happens to existing bond prices? Think about it — would you want a 3% bond when new bonds pay 5%?',
          },
          {
            q: 'XYZ stock drops 8% in a single day. Volume is 15x the 30-day average. What is the MOST important question you should ask?',
            options: ['Is the price going to bounce back?', 'What caused the volume spike — is the thesis broken or is this an overreaction?', 'Should I buy the dip?', 'When will it hit the bottom?'],
            correct: 1,
            explanation: 'Massive volume on a large price move means institutional investors are repositioning. The critical question is WHY. If it\'s an earnings miss, the thesis may be broken. If it\'s macro-driven (rate hike fears), the company itself may be fine. Context determines whether this is an opportunity or a warning.',
          },
          {
            q: 'You can buy insurance (a put option) on your $10,000 stock portfolio for $300 that protects you from any losses beyond 5% for the next 30 days. The market has been calm recently. Should you buy it?',
            options: ['No — if the market is calm, you don\'t need insurance', 'It depends on upcoming catalysts (earnings, Fed meetings, geopolitical risk)', 'Always buy protection', 'Never buy protection — it\'s a waste'],
            correct: 1,
            explanation: 'This is the core of options thinking. Insurance is cheapest when the market is calm (low implied volatility), but that\'s also when people think they don\'t need it. The right answer considers what COULD happen, not what\'s happening now. If there\'s an FOMC meeting or earnings in the next 30 days, that $300 might be a bargain.',
            followUp: 'This connects to a concept called "implied volatility" — the market\'s forecast of future turbulence. We\'ll dive deep into this soon.',
          },
        ],
      },
    ],
  },
  {
    id: 'options-basics',
    title: 'Options Fundamentals',
    icon: '\u{1F4D0}',
    description: 'Understanding the building blocks of options',
    modules: [
      {
        id: 'calls-puts',
        title: 'Calls & Puts: Your Two Building Blocks',
        type: 'lesson',
        content: {
          sections: [
            {
              title: 'The Right to Buy: Call Options',
              body: 'A **call option** gives you the RIGHT (not the obligation) to BUY 100 shares of a stock at a specific price (the **strike price**) before a specific date (the **expiration**). You pay a **premium** for this right.',
              keyInsight: 'Buying a call is bullish. You profit when the stock goes UP above your strike price plus the premium you paid. Your maximum loss is limited to the premium.',
              example: {
                scenario: 'AAPL is at $200. You buy the $210 call expiring in 30 days for $3.00 ($300 total for 100 shares).',
                outcomes: [
                  { condition: 'AAPL goes to $220', result: 'Option worth $10. Profit: $10 - $3 = $7 per share ($700 total). Return: +233%' },
                  { condition: 'AAPL stays at $200', result: 'Option expires worthless. Loss: $3 per share ($300 total). Return: -100%' },
                  { condition: 'AAPL drops to $180', result: 'Option expires worthless. Loss: Still only $3 per share ($300 total). Return: -100%' },
                ],
              },
              thinkAboutIt: 'Notice that the loss is the same whether AAPL stays at $200 or crashes to $180. Why is this important? How does this compare to holding 100 shares of AAPL outright?',
            },
            {
              title: 'The Right to Sell: Put Options',
              body: 'A **put option** gives you the RIGHT (not the obligation) to SELL 100 shares at the strike price before expiration. Buying puts is bearish — you profit when the stock goes DOWN.',
              keyInsight: 'Puts are portfolio insurance. If you own stock and buy a put, you\'ve guaranteed a minimum selling price. This is called a "protective put" or "married put."',
              example: {
                scenario: 'You own 100 shares of TSLA at $250. You buy the $240 put for $5.00 ($500 total).',
                outcomes: [
                  { condition: 'TSLA crashes to $200', result: 'Put worth $40. Stock loss: $5,000. Put gain: $3,500. Net loss: only $1,500 instead of $5,000' },
                  { condition: 'TSLA rises to $300', result: 'Put expires worthless. Stock gain: $5,000. Net gain: $4,500 (profit minus put cost)' },
                ],
              },
              thinkAboutIt: 'The put cost you $500 and TSLA went up — so you "lost" that $500. But you slept well every night knowing your downside was limited. Is peace of mind worth $500? This is the fundamental question of options pricing.',
            },
            {
              title: 'The Options Chain: Reading the Menu',
              body: 'An options chain shows all available strikes and expirations for a given stock. Each row is a different strike price. The columns show the bid, ask, volume, open interest, and the **Greeks** (which we\'ll cover in depth).',
              keyInsight: 'Focus on where the money is. "In the money" (ITM) options have intrinsic value — the stock has already passed the strike. "Out of the money" (OTM) options are pure time value — you\'re betting the stock will move enough.',
              points: [
                { term: 'ITM Call', def: 'Strike below current price. Has intrinsic value. Example: $190 call when stock is at $200' },
                { term: 'ATM Call', def: 'Strike at or near current price. Example: $200 call when stock is at $200' },
                { term: 'OTM Call', def: 'Strike above current price. No intrinsic value yet. Example: $210 call when stock is at $200' },
                { term: 'ITM Put', def: 'Strike above current price. Example: $210 put when stock is at $200' },
                { term: 'OTM Put', def: 'Strike below current price. Example: $190 put when stock is at $200' },
              ],
              thinkAboutIt: 'If a $200 call costs $5 and a $210 call costs $2, which is the "better" buy? The answer isn\'t as simple as "cheaper is better." Think about what needs to happen for each to be profitable.',
            },
          ],
        },
      },
      {
        id: 'intrinsic-extrinsic',
        title: 'Intrinsic vs. Extrinsic Value',
        type: 'lesson',
        content: {
          sections: [
            {
              title: 'Decomposing an Option\'s Price',
              body: 'Every option premium is made up of two components: **intrinsic value** (real, tangible value right now) and **extrinsic value** (time value + volatility premium — the "hope" premium).',
              keyInsight: 'Intrinsic value = MAX(0, Stock Price - Strike) for calls, or MAX(0, Strike - Stock Price) for puts. Everything else in the premium is extrinsic — and extrinsic value goes to ZERO at expiration.',
              animation: 'optionValue',
              thinkAboutIt: 'At expiration, an option is worth either its intrinsic value or zero. All the "hope" premium evaporates. This is why selling options can be profitable — you\'re selling time that decays to zero.',
            },
            {
              title: 'Time Decay: The Option Seller\'s Best Friend',
              body: 'Extrinsic value decays over time — this is called **theta decay**. The decay accelerates as expiration approaches, following a square root curve. An option loses about 1/3 of its time value in the first half of its life, and 2/3 in the second half.',
              keyInsight: 'If you buy options, time is your enemy. If you sell options, time is your friend. This asymmetry is the foundation of many professional trading strategies.',
              animation: 'thetaDecay',
              thinkAboutIt: 'If time decay accelerates near expiration, when is the "worst" time to buy options? And when is the "best" time to sell them? (Hint: think about the decay curve shape)',
            },
          ],
        },
      },
      {
        id: 'options-basics-quiz',
        title: 'Options Basics Assessment',
        type: 'quiz',
        questions: [
          {
            q: 'NVDA is at $800. The $850 call expiring in 45 days costs $20 ($2,000). What must NVDA\'s price be at expiration for you to break even?',
            options: ['$850', '$870', '$820', '$800'],
            correct: 1,
            explanation: 'Breakeven = Strike + Premium = $850 + $20 = $870. At $870, the call is worth exactly $20 (its intrinsic value of $870-$850=$20), which equals what you paid. Below $870, you lose money. Above $870, you profit dollar-for-dollar.',
            followUp: 'At $860, the option has $10 of intrinsic value but cost $20. You\'d lose $10 per share ($1,000 total). The option is "in the money" but you still lost. ITM does NOT mean profitable!',
          },
          {
            q: 'You bought a call for $5.00 three weeks ago. The stock hasn\'t moved at all, but the option is now worth $3.50. What happened?',
            options: ['The market maker is cheating you', 'Theta decay — time passed and the extrinsic value eroded', 'Implied volatility increased', 'The bid-ask spread widened'],
            correct: 1,
            explanation: 'With the stock unchanged, the intrinsic value is the same. But 3 weeks of time has passed, eating away at the extrinsic (time) value. The option went from having 6+ weeks of "hope" to only 3+ weeks. That\'s $1.50/share ($150 total) lost to theta — roughly $7.14 per day.',
          },
          {
            q: 'A stock is at $100. The $95 put costs $2 and the $105 put costs $8. Break down the intrinsic and extrinsic values of each.',
            options: [
              '$95 put: $0 intrinsic / $2 extrinsic. $105 put: $5 intrinsic / $3 extrinsic',
              '$95 put: $2 intrinsic / $0 extrinsic. $105 put: $8 intrinsic / $0 extrinsic',
              '$95 put: $5 intrinsic / $0 extrinsic. $105 put: $3 intrinsic / $5 extrinsic',
              '$95 put: $0 intrinsic / $2 extrinsic. $105 put: $8 intrinsic / $0 extrinsic',
            ],
            correct: 0,
            explanation: 'For puts, intrinsic value = MAX(0, Strike - Stock Price). The $95 put: MAX(0, 95-100) = $0 intrinsic, so all $2 is extrinsic. The $105 put: MAX(0, 105-100) = $5 intrinsic, leaving $3 extrinsic ($8 - $5). The ITM put still has time value!',
            followUp: 'Notice the OTM $95 put is ALL time value. At expiration, if the stock is still at $100, this option is worth $0. The seller keeps the entire $2. See why selling OTM options can be profitable?',
          },
        ],
      },
    ],
  },
  {
    id: 'volatility',
    title: 'Volatility & Pricing',
    icon: '\u{26A1}',
    description: 'The heartbeat of options — volatility drives everything',
    modules: [
      {
        id: 'historical-vol',
        title: 'Historical Volatility: Looking Backward',
        type: 'lesson',
        content: {
          sections: [
            {
              title: 'Measuring Past Turbulence',
              body: 'Historical volatility (HV) measures how much a stock\'s price has actually moved over a past period. It\'s calculated as the annualized standard deviation of daily returns. An HV of 30% means the stock\'s daily moves have a standard deviation of about 1.9% (30% / sqrt(252)).',
              keyInsight: 'HV is a fact — it tells you what DID happen. But markets are forward-looking. What WILL happen is captured by implied volatility. The gap between HV and IV is where opportunities live.',
              animation: 'historicalVol',
              thinkAboutIt: 'A stock had 20% HV last month but 40% HV last year. Which number matters more for pricing a 30-day option? What about a 6-month option?',
            },
            {
              title: 'Volatility Regimes',
              body: 'Markets alternate between low-volatility "calm" periods and high-volatility "storm" periods. Low vol tends to cluster (calm begets calm) until a shock arrives. High vol also clusters — once fear enters, it takes time to dissipate.',
              keyInsight: 'The VIX (S&P 500 implied volatility) has spent about 70% of time below 20, but the worst losses happen when it spikes above 30. Low VIX is NOT "safe" — it\'s when markets are most complacent and least prepared for shocks.',
            },
          ],
        },
      },
      {
        id: 'implied-vol',
        title: 'Implied Volatility: Looking Forward',
        type: 'lesson',
        content: {
          sections: [
            {
              title: 'The Market\'s Fear Gauge',
              body: 'Implied volatility (IV) is the market\'s consensus forecast of future volatility, extracted from option prices using pricing models (Black-Scholes). When option prices go UP (people buying protection), IV rises. When prices fall (calm), IV drops.',
              keyInsight: 'IV is the single most important variable in options trading. A stock can go UP and your call can LOSE money if IV drops enough. This is called "IV crush" and it destroys unprepared traders.',
              animation: 'impliedVol',
              thinkAboutIt: 'Before earnings, IV tends to spike (uncertainty). After earnings, IV collapses (uncertainty resolved). If you buy a call before earnings and the stock goes up 2%, but IV drops 30%, what happens to your option?',
            },
            {
              title: 'IV Rank and IV Percentile',
              body: 'Raw IV numbers are meaningless without context. NVDA at 40% IV might be low for NVDA but extremely high for KO (Coca-Cola). That\'s why we use IV Rank (where current IV falls in its 52-week range) and IV Percentile (% of days IV was lower than today).',
              keyInsight: 'When IV Rank > 50, options are relatively expensive — favor selling strategies. When IV Rank < 30, options are cheap — favor buying strategies. This alone can dramatically improve your options trading.',
              thinkAboutIt: 'If IV Rank is 90% (near the top of its range), what strategies would benefit? Think about it — you\'d want to be a NET SELLER of options to capture the elevated premium.',
            },
          ],
        },
      },
      {
        id: 'greeks',
        title: 'The Greeks: Your Risk Dashboard',
        type: 'lesson',
        content: {
          sections: [
            {
              title: 'Delta: Directional Exposure',
              body: 'Delta measures how much an option\'s price changes for a $1 move in the underlying stock. A call with 0.50 delta gains ~$0.50 when the stock rises $1. Delta ranges from 0 to 1 for calls, 0 to -1 for puts.',
              keyInsight: 'Delta also approximates the probability of expiring in the money. A 0.30 delta call has roughly a 30% chance of being profitable at expiration. Deep ITM options have deltas near 1.0 (almost 100% probability).',
              points: [
                { term: 'Delta 0.80 Call', def: 'Deep ITM. Moves almost like stock. 80% chance of expiring ITM.' },
                { term: 'Delta 0.50 Call', def: 'ATM. 50/50 chance. Most sensitive to direction changes.' },
                { term: 'Delta 0.20 Call', def: 'Far OTM. Cheap "lottery ticket." Only 20% chance of paying off.' },
              ],
              thinkAboutIt: 'If you own 5 calls with 0.40 delta each, your position acts like owning 200 shares (5 x 100 x 0.40). This "delta equivalent" helps you size positions. How many 0.30 delta puts would you need to hedge 300 shares?',
            },
            {
              title: 'Gamma: The Accelerator',
              body: 'Gamma measures how fast delta changes. High gamma means your delta is shifting rapidly — your position is getting more bullish (or bearish) as the stock moves. Gamma is highest for ATM options near expiration.',
              keyInsight: 'Gamma is the curvature of the option\'s payoff. It\'s what makes options non-linear — a 0.50 delta call that gains $5 of intrinsic might see its delta jump to 0.70. Your gains accelerate. This convexity is the "magic" of options.',
            },
            {
              title: 'Theta: Time\'s Tax',
              body: 'Theta measures daily time decay in dollars. A theta of -$0.05 means your option loses $5 per day just from the passage of time (for 100 shares). Theta is negative for option buyers (costs you money) and positive for sellers (earns you money).',
              keyInsight: 'ATM options have the highest theta. OTM options have lower theta but also lower delta. The "sweet spot" for selling is usually slightly OTM with high IV — maximum theta with manageable risk.',
            },
            {
              title: 'Vega: Volatility Sensitivity',
              body: 'Vega measures how much the option price changes for a 1% move in implied volatility. A vega of $0.15 means your option gains $15 if IV rises 1%. Vega is highest for ATM options with more time to expiration.',
              keyInsight: 'Vega is why "IV crush" hurts. If you\'re long vega (bought options) and IV drops 10%, that\'s a $150 loss per contract even if the stock doesn\'t move. Always check IV rank before buying options.',
              thinkAboutIt: 'Earnings are tomorrow. IV is at its peak. You think the stock will go up 5%. Should you buy calls? Think carefully about what happens to IV AFTER the earnings are announced...',
            },
          ],
        },
      },
      {
        id: 'volatility-quiz',
        title: 'Volatility & Greeks Assessment',
        type: 'quiz',
        questions: [
          {
            q: 'TSLA reports earnings tonight. IV is 80% (IV Rank: 95%). You think TSLA will beat estimates. You buy the ATM call for $15. TSLA beats earnings and opens up 3% ($7.50). Your option is now worth $13.50. What went wrong?',
            options: [
              'Nothing — sometimes options lose money even when you\'re right',
              'IV crush — IV collapsed from 80% to ~45% after the uncertainty resolved, destroying more value than the stock\'s move added',
              'Theta decay overnight',
              'Gamma was too low',
            ],
            correct: 1,
            explanation: 'This is the classic earnings trap. You were RIGHT about the direction but WRONG about the volatility trade. The IV crush from 80% to ~45% wiped out roughly $5+ of vega value, which overwhelmed the $3+ you gained from delta. Net loss: $1.50/share ($150). Being right about direction is only half the battle.',
            followUp: 'Professional traders often SELL options before earnings precisely to capture this IV crush. They use spreads to limit risk while profiting from the collapse in premium.',
          },
          {
            q: 'You own a 0.60 delta call with gamma of 0.04. The stock jumps $5. What\'s your approximate new delta?',
            options: ['0.60', '0.64', '0.80', '0.40'],
            correct: 2,
            explanation: 'New delta = Old delta + (Gamma x Stock Move) = 0.60 + (0.04 x 5) = 0.80. Your position went from acting like 60 shares to acting like 80 shares. This acceleration is gamma at work — and it\'s why option P&L is non-linear. On the first $1 move you gained ~$60. By the fifth $1, you\'re gaining ~$78.',
          },
          {
            q: 'Two options on the same stock, same strike: Option A expires in 7 days (theta: -$0.25/day). Option B expires in 45 days (theta: -$0.08/day). Which should an option BUYER prefer?',
            options: [
              'Option A — it\'s cheaper',
              'Option B — less daily time decay gives the trade more room to work',
              'Either one — theta doesn\'t matter if you\'re right about direction',
              'Neither — always sell, never buy',
            ],
            correct: 1,
            explanation: 'Option B bleeds $0.08/day vs $0.25/day. Over the same holding period, you pay far less in theta. Buyers need time for their thesis to play out. Option A loses ~3x more value per day — even if you\'re right about direction, theta is working hard against you. This is why most professional option buyers use 30-60 DTE, not weeklies.',
          },
        ],
      },
    ],
  },
  {
    id: 'strategies',
    title: 'Options Strategies',
    icon: '\u{265F}',
    description: 'Combining calls and puts into powerful strategies',
    modules: [
      {
        id: 'vertical-spreads',
        title: 'Vertical Spreads: Defined Risk Trading',
        type: 'lesson',
        content: {
          sections: [
            {
              title: 'Bull Call Spread',
              body: 'Buy a lower-strike call and sell a higher-strike call with the same expiration. This reduces your cost (and max profit) but also reduces your risk. The max loss is the net premium paid; the max profit is the difference between strikes minus the premium.',
              example: {
                scenario: 'AAPL at $200. Buy $200 call for $8, Sell $210 call for $3. Net cost: $5 ($500).',
                outcomes: [
                  { condition: 'AAPL at $210+', result: 'Max profit: $10 - $5 = $5/share ($500). Return: +100%' },
                  { condition: 'AAPL at $205', result: 'Profit: $5 intrinsic - $5 cost = $0. Breakeven.' },
                  { condition: 'AAPL at $200 or below', result: 'Max loss: $5/share ($500). Return: -100%' },
                ],
              },
              keyInsight: 'The sold call finances part of the bought call. You cap your upside but you need less capital and have a defined, known maximum loss. Risk:Reward is clear before you enter.',
              thinkAboutIt: 'Compare: buying the $200 call alone for $8 gives unlimited upside but costs 60% more. The spread costs $5 but caps profit at $500. When does each make sense?',
            },
            {
              title: 'Bear Put Spread',
              body: 'Buy a higher-strike put and sell a lower-strike put. Bearish strategy with defined risk. Mirror image of the bull call spread.',
              keyInsight: 'Spreads let you take a directional view with known, defined risk. You\'ll never blow up your account with a properly sized spread — the worst that can happen is you lose the premium paid.',
            },
            {
              title: 'Iron Condor: Selling Volatility',
              body: 'Combine a bull put spread and a bear call spread. You\'re selling both sides — betting the stock stays WITHIN a range. Collect premium from both sides. Max profit when the stock stays between your short strikes at expiration.',
              keyInsight: 'Iron condors thrive in high IV, low movement environments. They\'re the bread and butter of professional options sellers. About 2/3 of the time, stock stays within 1 standard deviation — which is why iron condors have a statistical edge.',
              thinkAboutIt: 'If you sell an iron condor collecting $2.00 on a $5-wide spread, your max risk is $3.00. You make money 2 out of 3 times on average. But when you lose, you lose more. How would you manage this?',
            },
          ],
        },
      },
      {
        id: 'strategies-quiz',
        title: 'Strategies Assessment',
        type: 'quiz',
        questions: [
          {
            q: 'You sell a $100/$90 put spread on XYZ for $3.00 credit. The stock is at $105. What is your max profit, max loss, and breakeven?',
            options: [
              'Max profit: $3 ($300). Max loss: $7 ($700). Breakeven: $97.',
              'Max profit: $10 ($1,000). Max loss: $3 ($300). Breakeven: $103.',
              'Max profit: $3 ($300). Max loss: $10 ($1,000). Breakeven: $90.',
              'Max profit: $7 ($700). Max loss: $3 ($300). Breakeven: $97.',
            ],
            correct: 0,
            explanation: 'You sold the $100 put and bought the $90 put for a net credit of $3. Max profit = credit received = $3 (stock stays above $100). Max loss = spread width - credit = $10 - $3 = $7 (stock goes below $90). Breakeven = short strike - credit = $100 - $3 = $97.',
            followUp: 'With the stock at $105, you have $5 of "cushion." The stock has to drop 8% to reach your breakeven. This is why credit spreads are popular — you can be WRONG about direction and still profit.',
          },
          {
            q: 'IV Rank is 85%. You want to trade AMZN but aren\'t sure of direction. Which strategy best exploits the elevated volatility?',
            options: [
              'Buy a straddle (buy ATM call + put)',
              'Sell an iron condor (profit from high premium and expected IV contraction)',
              'Buy OTM calls for the next earnings',
              'Wait for IV to drop before trading',
            ],
            correct: 1,
            explanation: 'When IV is high (rank 85%), options are expensive. You want to be a net SELLER to capture that inflated premium. An iron condor collects premium from both sides and profits as IV contracts back to normal. Buying a straddle when IV is elevated means you\'re paying premium that\'s likely to shrink.',
          },
        ],
      },
    ],
  },
  {
    id: 'risk-management',
    title: 'Risk Management',
    icon: '\u{1F6E1}',
    description: 'Protecting capital is more important than making it',
    modules: [
      {
        id: 'position-sizing',
        title: 'Position Sizing: The 1-2% Rule',
        type: 'lesson',
        content: {
          sections: [
            {
              title: 'Never Risk More Than You Can Lose',
              body: 'Professional traders typically risk 1-2% of their total portfolio on any single trade. This means if you have a $50,000 account, your maximum loss per trade should be $500-$1,000. This rule alone keeps you in the game through inevitable losing streaks.',
              keyInsight: 'With 1% risk per trade, you could lose 10 trades in a row and only be down 10%. With 10% risk per trade, 3 losses in a row puts you down 27%. It takes a 37% gain to recover from a 27% loss, but only an 11% gain to recover from 10%.',
              thinkAboutIt: 'If you have a strategy that wins 60% of the time with a 2:1 reward-to-risk ratio, what percentage of your account should you risk per trade? Too little and you miss opportunity. Too much and you risk ruin.',
            },
            {
              title: 'Portfolio Heat: Total Risk Exposure',
              body: 'Even with proper per-trade sizing, you can still have too much total risk. "Portfolio heat" is the sum of all your individual position risks. Keep total portfolio heat under 6-10% — meaning if EVERYTHING goes wrong simultaneously, you lose no more than 10%.',
              keyInsight: 'Correlation kills diversification. If you have 5 "different" positions but they\'re all bullish on tech, a sector-wide drop hits all of them. True diversification means uncorrelated risks.',
            },
          ],
        },
      },
      {
        id: 'risk-quiz',
        title: 'Risk Management Assessment',
        type: 'quiz',
        questions: [
          {
            q: 'Your account is $25,000. You want to buy a call spread that costs $2.50 ($250). Using the 2% rule, what\'s the maximum number of these spreads you should buy?',
            options: ['1 spread', '2 spreads ($500 max risk)', '5 spreads', '10 spreads'],
            correct: 1,
            explanation: '2% of $25,000 = $500 max risk per trade. Each spread costs $250 (your max loss). $500 / $250 = 2 spreads maximum. Even though you might feel confident, disciplined sizing is what separates pros from amateurs.',
          },
        ],
      },
    ],
  },
]

// ─── Performance Tracker (adaptive pacing) ───
function getInitialProgress() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem('noctis-academy-progress') || '{}')
  } catch { return {} }
}

function saveProgress(progress) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem('noctis-academy-progress', JSON.stringify(progress)) } catch {}
}

// ─── Adaptive difficulty engine ───
function getAdaptiveSpeed(progress) {
  const quizScores = Object.values(progress).filter(p => p.type === 'quiz' && p.score !== undefined)
  if (quizScores.length === 0) return 'standard'
  const avgScore = quizScores.reduce((sum, p) => sum + p.score, 0) / quizScores.length
  const avgTime = quizScores.reduce((sum, p) => sum + (p.avgTime || 30), 0) / quizScores.length
  if (avgScore >= 0.85 && avgTime < 20) return 'accelerated'
  if (avgScore >= 0.7) return 'standard'
  return 'reinforced'
}

// ═══════════════════════════════════════════
//  Interactive Visualizations
// ═══════════════════════════════════════════

function OrderBookAnimation() {
  const [bids, setBids] = useState([
    { price: 99.95, size: 500 }, { price: 99.90, size: 800 },
    { price: 99.85, size: 1200 }, { price: 99.80, size: 300 },
  ])
  const [asks, setAsks] = useState([
    { price: 100.00, size: 400 }, { price: 100.05, size: 600 },
    { price: 100.10, size: 900 }, { price: 100.15, size: 200 },
  ])
  const [trades, setTrades] = useState([])
  const [lastPrice, setLastPrice] = useState(100.00)

  useEffect(() => {
    const interval = setInterval(() => {
      const isBuy = Math.random() > 0.5
      const size = Math.floor(Math.random() * 400) + 100
      const newPrice = isBuy
        ? asks[0]?.price || 100.00
        : bids[0]?.price || 99.95

      setLastPrice(newPrice)
      setTrades(prev => [{ price: newPrice, size, side: isBuy ? 'buy' : 'sell', time: Date.now() }, ...prev].slice(0, 8))

      // Shuffle order book sizes
      setBids(prev => prev.map(b => ({ ...b, size: Math.max(100, b.size + Math.floor((Math.random() - 0.5) * 200)) })))
      setAsks(prev => prev.map(a => ({ ...a, size: Math.max(100, a.size + Math.floor((Math.random() - 0.5) * 200)) })))
    }, 1500)
    return () => clearInterval(interval)
  }, [asks, bids])

  const maxSize = Math.max(...bids.map(b => b.size), ...asks.map(a => a.size))

  return (
    <div className="rounded-xl p-4 my-4" style={{ background: 'rgb(var(--nx-surface))', border: '1px solid var(--nx-border)' }}>
      <div className="text-xs font-bold text-nx-text-muted uppercase tracking-wider mb-3">Live Order Book Simulation</div>
      <div className="grid grid-cols-2 gap-4">
        {/* Bids */}
        <div>
          <div className="text-2xs font-semibold text-nx-green mb-2 uppercase tracking-wider">Bids (Buyers)</div>
          {bids.map((b, i) => (
            <div key={i} className="flex items-center gap-2 mb-1 relative">
              <div className="absolute inset-0 rounded" style={{ background: `rgba(var(--nx-green) / ${(b.size / maxSize) * 0.15})`, width: `${(b.size / maxSize) * 100}%` }} />
              <span className="text-xs font-mono text-nx-green relative z-10 w-16">${b.price.toFixed(2)}</span>
              <span className="text-2xs font-mono text-nx-text-muted relative z-10">{b.size}</span>
            </div>
          ))}
        </div>
        {/* Asks */}
        <div>
          <div className="text-2xs font-semibold text-nx-red mb-2 uppercase tracking-wider">Asks (Sellers)</div>
          {asks.map((a, i) => (
            <div key={i} className="flex items-center gap-2 mb-1 relative">
              <div className="absolute inset-0 rounded" style={{ background: `rgba(var(--nx-red) / ${(a.size / maxSize) * 0.15})`, width: `${(a.size / maxSize) * 100}%` }} />
              <span className="text-xs font-mono text-nx-red relative z-10 w-16">${a.price.toFixed(2)}</span>
              <span className="text-2xs font-mono text-nx-text-muted relative z-10">{a.size}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Recent trades */}
      <div className="mt-3 pt-3 border-t border-nx-border/30">
        <div className="text-2xs font-semibold text-nx-text-muted mb-1 uppercase tracking-wider">Recent Trades</div>
        <div className="flex flex-wrap gap-2">
          {trades.map((t, i) => (
            <span key={t.time} className="text-2xs font-mono px-2 py-0.5 rounded" style={{
              background: t.side === 'buy' ? 'var(--nx-green-muted)' : 'var(--nx-red-muted)',
              color: t.side === 'buy' ? 'rgb(var(--nx-green))' : 'rgb(var(--nx-red))',
              opacity: 1 - (i * 0.1),
            }}>
              ${t.price.toFixed(2)} x{t.size}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2 text-center">
        <span className="text-lg font-bold font-mono" style={{ color: lastPrice >= 100 ? 'rgb(var(--nx-green))' : 'rgb(var(--nx-red))' }}>
          Last: ${lastPrice.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

function ThetaDecayAnimation() {
  const [daysToExp, setDaysToExp] = useState(60)
  const [isPlaying, setIsPlaying] = useState(false)
  const intervalRef = useRef(null)

  const timeValues = useMemo(() => {
    const points = []
    for (let d = 60; d >= 0; d--) {
      const tv = 5.00 * Math.sqrt(d / 60)
      points.push({ day: 60 - d, dte: d, value: tv })
    }
    return points
  }, [])

  useEffect(() => {
    if (isPlaying && daysToExp > 0) {
      intervalRef.current = setInterval(() => {
        setDaysToExp(prev => {
          if (prev <= 0) { setIsPlaying(false); return 0 }
          return prev - 1
        })
      }, 150)
    }
    return () => clearInterval(intervalRef.current)
  }, [isPlaying, daysToExp])

  const currentValue = 5.00 * Math.sqrt(daysToExp / 60)
  const dailyDecay = daysToExp > 0 ? (5.00 * Math.sqrt(daysToExp / 60) - 5.00 * Math.sqrt((daysToExp - 1) / 60)) : 0

  return (
    <div className="rounded-xl p-4 my-4" style={{ background: 'rgb(var(--nx-surface))', border: '1px solid var(--nx-border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-nx-text-muted uppercase tracking-wider">Theta Decay Visualization</div>
        <div className="flex gap-2">
          <button onClick={() => { setIsPlaying(!isPlaying) }} className="px-3 py-1 rounded-lg text-2xs font-semibold" style={{ background: 'var(--nx-accent-muted)', color: 'rgb(var(--nx-accent))' }}>
            {isPlaying ? '\u23F8 Pause' : '\u25B6 Play'}
          </button>
          <button onClick={() => { setDaysToExp(60); setIsPlaying(false) }} className="px-3 py-1 rounded-lg text-2xs font-semibold" style={{ background: 'var(--nx-glass)', color: 'rgb(var(--nx-text-muted))' }}>
            \u21BB Reset
          </button>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative" style={{ height: '180px' }}>
        <svg viewBox="0 0 400 150" className="w-full h-full">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4, 5].map(v => (
            <g key={v}>
              <line x1="40" y1={130 - v * 24} x2="390" y2={130 - v * 24} stroke="var(--nx-border)" strokeWidth="0.5" />
              <text x="35" y={134 - v * 24} textAnchor="end" fill="rgb(var(--nx-text-muted))" fontSize="8" fontFamily="monospace">${v.toFixed(0)}</text>
            </g>
          ))}

          {/* Decay curve */}
          <path
            d={timeValues.map((p, i) => `${i === 0 ? 'M' : 'L'} ${40 + (p.day / 60) * 350} ${130 - (p.value / 5) * 120}`).join(' ')}
            fill="none" stroke="rgb(var(--nx-accent))" strokeWidth="2" opacity="0.3"
          />

          {/* Filled area up to current day */}
          <path
            d={timeValues.filter(p => p.dte >= daysToExp).map((p, i) => `${i === 0 ? 'M' : 'L'} ${40 + (p.day / 60) * 350} ${130 - (p.value / 5) * 120}`).join(' ') + ` L ${40 + ((60 - daysToExp) / 60) * 350} 130 L 40 130 Z`}
            fill="rgba(var(--nx-accent) / 0.08)"
          />

          {/* Current position marker */}
          <circle
            cx={40 + ((60 - daysToExp) / 60) * 350}
            cy={130 - (currentValue / 5) * 120}
            r="5" fill="rgb(var(--nx-accent))"
          />

          {/* X-axis label */}
          <text x="215" y="148" textAnchor="middle" fill="rgb(var(--nx-text-muted))" fontSize="8">Days Passed</text>
        </svg>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mt-2">
        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--nx-glass)' }}>
          <div className="text-2xs text-nx-text-muted">Days to Exp</div>
          <div className="text-sm font-bold font-mono text-nx-accent">{daysToExp}</div>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--nx-glass)' }}>
          <div className="text-2xs text-nx-text-muted">Time Value</div>
          <div className="text-sm font-bold font-mono text-nx-text-strong">${currentValue.toFixed(2)}</div>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--nx-glass)' }}>
          <div className="text-2xs text-nx-text-muted">Daily Decay</div>
          <div className="text-sm font-bold font-mono text-nx-red">{dailyDecay > 0 ? `-$${dailyDecay.toFixed(3)}` : '$0.00'}</div>
        </div>
      </div>

      {/* Slider */}
      <div className="mt-3">
        <input type="range" min="0" max="60" value={daysToExp} onChange={e => { setDaysToExp(Number(e.target.value)); setIsPlaying(false) }}
          className="w-full accent-nx-accent" style={{ accentColor: 'rgb(var(--nx-accent))' }} />
      </div>
    </div>
  )
}

function OptionPayoffDiagram({ strike = 200, premium = 5, type = 'call' }) {
  const [stockPrice, setStockPrice] = useState(strike)

  const payoff = useMemo(() => {
    if (type === 'call') return Math.max(0, stockPrice - strike) - premium
    return Math.max(0, strike - stockPrice) - premium
  }, [stockPrice, strike, premium, type])

  const points = useMemo(() => {
    const pts = []
    for (let p = strike - 30; p <= strike + 30; p += 1) {
      const pnl = type === 'call'
        ? Math.max(0, p - strike) - premium
        : Math.max(0, strike - p) - premium
      pts.push({ price: p, pnl })
    }
    return pts
  }, [strike, premium, type])

  return (
    <div className="rounded-xl p-4 my-4" style={{ background: 'rgb(var(--nx-surface))', border: '1px solid var(--nx-border)' }}>
      <div className="text-xs font-bold text-nx-text-muted uppercase tracking-wider mb-3">
        {type === 'call' ? 'Call' : 'Put'} Option Payoff — Strike ${strike}, Premium ${premium}
      </div>

      <div className="relative" style={{ height: '160px' }}>
        <svg viewBox="0 0 400 140" className="w-full h-full">
          {/* Zero line */}
          <line x1="20" y1="70" x2="390" y2="70" stroke="var(--nx-border)" strokeWidth="1" strokeDasharray="4,4" />
          <text x="15" y="73" textAnchor="end" fill="rgb(var(--nx-text-muted))" fontSize="7">$0</text>

          {/* Strike line */}
          <line x1={20 + (30/60)*370} y1="10" x2={20 + (30/60)*370} y2="130" stroke="rgb(var(--nx-accent))" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
          <text x={20 + (30/60)*370} y="138" textAnchor="middle" fill="rgb(var(--nx-accent))" fontSize="7">${strike}</text>

          {/* Payoff curve */}
          <path
            d={points.map((p, i) => {
              const x = 20 + ((p.price - (strike - 30)) / 60) * 370
              const y = 70 - (p.pnl / 25) * 60
              return `${i === 0 ? 'M' : 'L'} ${x} ${Math.max(5, Math.min(135, y))}`
            }).join(' ')}
            fill="none" stroke={payoff >= 0 ? 'rgb(var(--nx-green))' : 'rgb(var(--nx-red))'} strokeWidth="2.5"
          />

          {/* Current price marker */}
          <circle
            cx={20 + ((stockPrice - (strike - 30)) / 60) * 370}
            cy={Math.max(5, Math.min(135, 70 - (payoff / 25) * 60))}
            r="5" fill={payoff >= 0 ? 'rgb(var(--nx-green))' : 'rgb(var(--nx-red))'}
          />

          {/* Max loss line */}
          <text x="25" y={70 + (premium / 25) * 60 + 3} fill="rgb(var(--nx-red))" fontSize="7">Max Loss: -${premium}</text>
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-2">
        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--nx-glass)' }}>
          <div className="text-2xs text-nx-text-muted">Stock Price</div>
          <div className="text-sm font-bold font-mono text-nx-text-strong">${stockPrice}</div>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--nx-glass)' }}>
          <div className="text-2xs text-nx-text-muted">P&L</div>
          <div className={`text-sm font-bold font-mono ${payoff >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>
            {payoff >= 0 ? '+' : ''}{payoff.toFixed(2)}
          </div>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--nx-glass)' }}>
          <div className="text-2xs text-nx-text-muted">Breakeven</div>
          <div className="text-sm font-bold font-mono text-nx-accent">${type === 'call' ? strike + premium : strike - premium}</div>
        </div>
      </div>

      <input type="range" min={strike - 30} max={strike + 30} value={stockPrice}
        onChange={e => setStockPrice(Number(e.target.value))}
        className="w-full mt-2" style={{ accentColor: 'rgb(var(--nx-accent))' }} />
      <div className="flex justify-between text-2xs text-nx-text-muted font-mono mt-1">
        <span>${strike - 30}</span>
        <span>${strike + 30}</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
//  Lesson Renderer
// ═══════════════════════════════════════════
function LessonView({ module, onComplete, speed }) {
  const [currentSection, setCurrentSection] = useState(0)
  const [revealedInsights, setRevealedInsights] = useState({})
  const sections = module.content.sections

  const section = sections[currentSection]
  const isLast = currentSection === sections.length - 1
  const progress = ((currentSection + 1) / sections.length) * 100

  const renderAnimation = (type) => {
    switch (type) {
      case 'orderbook': return <OrderBookAnimation />
      case 'thetaDecay': return <ThetaDecayAnimation />
      case 'optionValue': return <OptionPayoffDiagram type="call" />
      case 'historicalVol': return <ThetaDecayAnimation />
      case 'impliedVol': return <OptionPayoffDiagram type="put" />
      default: return null
    }
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--nx-glass)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, rgb(var(--nx-accent)), rgb(var(--nx-purple)))' }} />
        </div>
        <span className="text-2xs font-mono text-nx-text-muted">{currentSection + 1}/{sections.length}</span>
        {speed !== 'standard' && (
          <span className="text-2xs px-2 py-0.5 rounded-md font-semibold" style={{
            background: speed === 'accelerated' ? 'var(--nx-green-muted)' : 'var(--nx-orange-muted)',
            color: speed === 'accelerated' ? 'rgb(var(--nx-green))' : 'rgb(var(--nx-orange))',
          }}>
            {speed === 'accelerated' ? '\u26A1 Accelerated' : '\u{1F504} Review Mode'}
          </span>
        )}
      </div>

      {/* Section content */}
      <div className="nx-card p-5 space-y-4">
        <h3 className="text-lg font-bold text-nx-text-strong">{section.title}</h3>

        <div className="text-sm leading-relaxed text-nx-text" style={{ whiteSpace: 'pre-line' }}>
          {section.body.split('**').map((part, i) =>
            i % 2 === 1 ? <strong key={i} className="text-nx-accent font-semibold">{part}</strong> : <span key={i}>{part}</span>
          )}
        </div>

        {/* Key points list */}
        {section.points && (
          <div className="space-y-2 mt-3">
            {section.points.map((point, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg" style={{ background: 'var(--nx-glass)' }}>
                <div className="w-1 rounded-full flex-shrink-0" style={{ background: 'rgb(var(--nx-accent))' }} />
                <div>
                  <div className="text-sm font-semibold text-nx-accent">{point.term}</div>
                  <div className="text-sm text-nx-text-muted mt-0.5">{point.def}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Interactive animation */}
        {section.animation && renderAnimation(section.animation)}

        {/* Trade example */}
        {section.example && (
          <div className="rounded-xl p-4 mt-3" style={{ background: 'var(--nx-glass)', border: '1px solid var(--nx-border)' }}>
            <div className="text-xs font-bold text-nx-accent uppercase tracking-wider mb-2">{'\u{1F4CB}'} Worked Example</div>
            <div className="text-sm text-nx-text-strong mb-3">{section.example.scenario}</div>
            <div className="space-y-2">
              {section.example.outcomes.map((o, i) => (
                <div key={i} className="flex gap-3 p-2 rounded-lg" style={{ background: 'rgb(var(--nx-surface))' }}>
                  <div className="text-2xs font-semibold text-nx-text-muted min-w-[140px]">{o.condition}</div>
                  <div className="text-2xs text-nx-text-strong">{o.result}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key insight — collapsible */}
        {section.keyInsight && (
          <div className="rounded-xl p-4 mt-3 cursor-pointer transition-all duration-200"
            onClick={() => setRevealedInsights(prev => ({ ...prev, [currentSection + '-insight']: true }))}
            style={{
              background: revealedInsights[currentSection + '-insight'] ? 'rgba(var(--nx-accent) / 0.08)' : 'var(--nx-glass)',
              border: `1px solid ${revealedInsights[currentSection + '-insight'] ? 'rgba(var(--nx-accent) / 0.2)' : 'var(--nx-border)'}`,
            }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgb(var(--nx-accent))' }}>
              {revealedInsights[currentSection + '-insight'] ? '\u{1F4A1} Key Insight' : '\u{1F4A1} Tap to Reveal Key Insight'}
            </div>
            {revealedInsights[currentSection + '-insight'] && (
              <p className="text-sm text-nx-text-strong leading-relaxed">{section.keyInsight}</p>
            )}
          </div>
        )}

        {/* Think About It — Socratic questioning */}
        {section.thinkAboutIt && (
          <div className="rounded-xl p-4 mt-3" style={{ background: 'rgba(var(--nx-purple) / 0.06)', border: '1px solid rgba(var(--nx-purple) / 0.15)' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgb(var(--nx-purple))' }}>
              {'\u{1F914}'} Think About It
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgb(var(--nx-purple))' }}>{section.thinkAboutIt}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
          disabled={currentSection === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
          style={{
            background: currentSection === 0 ? 'var(--nx-glass)' : 'var(--nx-accent-muted)',
            color: currentSection === 0 ? 'rgb(var(--nx-text-hint))' : 'rgb(var(--nx-accent))',
            opacity: currentSection === 0 ? 0.5 : 1,
          }}
        >
          \u2190 Previous
        </button>

        <button
          onClick={() => {
            if (isLast) { onComplete() }
            else { setCurrentSection(currentSection + 1) }
          }}
          className="px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200"
          style={{
            background: isLast ? 'rgb(var(--nx-green))' : 'rgb(var(--nx-accent))',
            color: '#fff',
            boxShadow: isLast ? '0 0 20px rgba(var(--nx-green) / 0.3)' : '0 0 20px rgba(var(--nx-accent) / 0.2)',
          }}
        >
          {isLast ? '\u2713 Complete Lesson' : 'Next \u2192'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
//  Quiz Renderer
// ═══════════════════════════════════════════
function QuizView({ module, onComplete, speed }) {
  const [currentQ, setCurrentQ] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [score, setScore] = useState(0)
  const [startTime, setStartTime] = useState(Date.now())
  const [totalTime, setTotalTime] = useState(0)
  const [finished, setFinished] = useState(false)

  const questions = module.questions
  const question = questions[currentQ]
  const isCorrect = selectedAnswer === question?.correct

  const handleAnswer = (index) => {
    if (showResult) return
    setSelectedAnswer(index)
    setShowResult(true)
    const elapsed = (Date.now() - startTime) / 1000
    setTotalTime(prev => prev + elapsed)
    if (index === question.correct) setScore(prev => prev + 1)
  }

  const handleNext = () => {
    if (currentQ >= questions.length - 1) {
      setFinished(true)
      onComplete({
        score: (score + (isCorrect ? 0 : 0)) / questions.length,
        avgTime: totalTime / questions.length,
        total: questions.length,
        correct: score,
      })
    } else {
      setCurrentQ(currentQ + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setShowFollowUp(false)
      setStartTime(Date.now())
    }
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div className="nx-card p-6 text-center space-y-4">
        <div className="text-4xl mb-2">{pct >= 80 ? '\u{1F3C6}' : pct >= 60 ? '\u{1F4AA}' : '\u{1F4DA}'}</div>
        <h3 className="text-xl font-bold text-nx-text-strong">Assessment Complete</h3>
        <div className="text-3xl font-bold font-mono" style={{ color: pct >= 80 ? 'rgb(var(--nx-green))' : pct >= 60 ? 'rgb(var(--nx-orange))' : 'rgb(var(--nx-red))' }}>
          {score}/{questions.length} ({pct}%)
        </div>
        <p className="text-sm text-nx-text-muted max-w-md mx-auto">
          {pct >= 80 ? 'Excellent! You\'ve demonstrated strong understanding. The pace will accelerate for upcoming modules.' :
           pct >= 60 ? 'Good foundation. Some concepts may need reinforcement. We\'ll revisit key points in future lessons.' :
           'Let\'s slow down and build a stronger foundation. Review the material and try again when ready.'}
        </p>
        <div className="text-2xs text-nx-text-hint">Avg response time: {(totalTime / questions.length).toFixed(1)}s per question</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div key={i} className="w-6 h-1 rounded-full" style={{
              background: i < currentQ ? 'rgb(var(--nx-green))' : i === currentQ ? 'rgb(var(--nx-accent))' : 'var(--nx-glass)',
            }} />
          ))}
        </div>
        <span className="text-2xs font-mono text-nx-text-muted">Q{currentQ + 1}/{questions.length}</span>
        <span className="text-2xs px-2 py-0.5 rounded-md font-semibold" style={{ background: 'var(--nx-green-muted)', color: 'rgb(var(--nx-green))' }}>
          Score: {score}/{currentQ}
        </span>
      </div>

      {/* Question */}
      <div className="nx-card p-5 space-y-4">
        <div className="text-xs font-bold text-nx-accent uppercase tracking-wider">Question {currentQ + 1}</div>
        <h3 className="text-base font-semibold text-nx-text-strong leading-relaxed">{question.q}</h3>

        {/* Options */}
        <div className="space-y-2">
          {question.options.map((opt, i) => {
            let optStyle = { background: 'var(--nx-glass)', border: '1px solid var(--nx-border)', color: 'rgb(var(--nx-text))' }
            if (showResult) {
              if (i === question.correct) optStyle = { background: 'rgba(var(--nx-green) / 0.1)', border: '1px solid rgba(var(--nx-green) / 0.3)', color: 'rgb(var(--nx-green))' }
              else if (i === selectedAnswer && i !== question.correct) optStyle = { background: 'rgba(var(--nx-red) / 0.1)', border: '1px solid rgba(var(--nx-red) / 0.3)', color: 'rgb(var(--nx-red))' }
            } else if (selectedAnswer === i) {
              optStyle = { background: 'var(--nx-accent-muted)', border: '1px solid rgba(var(--nx-accent) / 0.3)', color: 'rgb(var(--nx-accent))' }
            }

            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={showResult}
                className="w-full text-left p-3 rounded-lg text-sm font-medium transition-all duration-200"
                style={optStyle}
              >
                <span className="font-mono mr-2 opacity-50">{String.fromCharCode(65 + i)}.</span>
                {opt}
              </button>
            )
          })}
        </div>

        {/* Result explanation */}
        {showResult && (
          <div className="space-y-3 animate-slide-up">
            <div className="rounded-xl p-4" style={{
              background: isCorrect ? 'rgba(var(--nx-green) / 0.06)' : 'rgba(var(--nx-red) / 0.06)',
              border: `1px solid ${isCorrect ? 'rgba(var(--nx-green) / 0.15)' : 'rgba(var(--nx-red) / 0.15)'}`,
            }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: isCorrect ? 'rgb(var(--nx-green))' : 'rgb(var(--nx-red))' }}>
                {isCorrect ? '\u2713 Correct!' : '\u2717 Not Quite'}
              </div>
              <p className="text-sm leading-relaxed text-nx-text-strong">{question.explanation}</p>
            </div>

            {/* Follow-up Socratic question */}
            {question.followUp && (
              <div>
                {!showFollowUp ? (
                  <button onClick={() => setShowFollowUp(true)} className="text-2xs font-semibold px-3 py-1.5 rounded-lg transition-all" style={{ background: 'rgba(var(--nx-purple) / 0.08)', color: 'rgb(var(--nx-purple))' }}>
                    {'\u{1F914}'} Dig Deeper...
                  </button>
                ) : (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(var(--nx-purple) / 0.06)', border: '1px solid rgba(var(--nx-purple) / 0.15)' }}>
                    <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgb(var(--nx-purple))' }}>Think Further</div>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgb(var(--nx-purple))' }}>{question.followUp}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Next button */}
      {showResult && (
        <div className="flex justify-end">
          <button onClick={handleNext} className="px-5 py-2 rounded-lg text-sm font-bold" style={{ background: 'rgb(var(--nx-accent))', color: '#fff', boxShadow: '0 0 20px rgba(var(--nx-accent) / 0.2)' }}>
            {currentQ >= questions.length - 1 ? 'See Results' : 'Next Question \u2192'}
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
//  Main TradingGuide Component
// ═══════════════════════════════════════════
export default function TradingGuide() {
  const [progress, setProgress] = useState(getInitialProgress)
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [selectedModule, setSelectedModule] = useState(null)

  const speed = useMemo(() => getAdaptiveSpeed(progress), [progress])

  const handleComplete = useCallback((moduleId, quizResult) => {
    setProgress(prev => {
      const next = {
        ...prev,
        [moduleId]: {
          completed: true,
          completedAt: Date.now(),
          ...(quizResult ? { type: 'quiz', score: quizResult.score, avgTime: quizResult.avgTime } : { type: 'lesson' }),
        },
      }
      saveProgress(next)
      return next
    })
    setSelectedModule(null)
  }, [])

  const totalModules = CURRICULUM.reduce((sum, unit) => sum + unit.modules.length, 0)
  const completedModules = Object.keys(progress).filter(k => progress[k]?.completed).length
  const overallProgress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0

  // If viewing a module
  if (selectedModule) {
    const unit = CURRICULUM.find(u => u.modules.some(m => m.id === selectedModule))
    const mod = unit?.modules.find(m => m.id === selectedModule)
    if (!mod) return null

    return (
      <div className="space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-2xs text-nx-text-muted">
          <button onClick={() => { setSelectedModule(null); setSelectedUnit(null) }} className="hover:text-nx-accent transition-colors">Academy</button>
          <span>/</span>
          <button onClick={() => setSelectedModule(null)} className="hover:text-nx-accent transition-colors">{unit?.title}</button>
          <span>/</span>
          <span className="text-nx-text-strong font-semibold">{mod.title}</span>
        </div>

        <h2 className="text-xl font-bold text-nx-text-strong">{mod.title}</h2>

        {mod.type === 'quiz' ? (
          <QuizView
            module={mod}
            speed={speed}
            onComplete={(result) => handleComplete(mod.id, result)}
          />
        ) : (
          <LessonView
            module={mod}
            speed={speed}
            onComplete={() => handleComplete(mod.id)}
          />
        )}
      </div>
    )
  }

  // Unit detail view
  if (selectedUnit) {
    const unit = CURRICULUM.find(u => u.id === selectedUnit)
    if (!unit) return null

    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedUnit(null)} className="text-2xs text-nx-text-muted hover:text-nx-accent transition-colors">
          \u2190 Back to Academy
        </button>

        <div className="flex items-center gap-3">
          <span className="text-2xl">{unit.icon}</span>
          <div>
            <h2 className="text-xl font-bold text-nx-text-strong">{unit.title}</h2>
            <p className="text-sm text-nx-text-muted">{unit.description}</p>
          </div>
        </div>

        <div className="space-y-2">
          {unit.modules.map((mod, i) => {
            const isCompleted = progress[mod.id]?.completed
            const isQuiz = mod.type === 'quiz'
            const quizScore = progress[mod.id]?.score

            return (
              <button
                key={mod.id}
                onClick={() => setSelectedModule(mod.id)}
                className="w-full text-left p-4 rounded-xl transition-all duration-200 flex items-center gap-4 group"
                style={{
                  background: isCompleted ? 'rgba(var(--nx-green) / 0.04)' : 'var(--nx-glass)',
                  border: `1px solid ${isCompleted ? 'rgba(var(--nx-green) / 0.15)' : 'var(--nx-border)'}`,
                }}
              >
                {/* Number / Check */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{
                  background: isCompleted ? 'rgba(var(--nx-green) / 0.15)' : isQuiz ? 'rgba(var(--nx-purple) / 0.1)' : 'var(--nx-accent-muted)',
                  color: isCompleted ? 'rgb(var(--nx-green))' : isQuiz ? 'rgb(var(--nx-purple))' : 'rgb(var(--nx-accent))',
                }}>
                  {isCompleted ? <span className="text-sm">\u2713</span> : <span className="text-xs font-bold">{isQuiz ? '?' : i + 1}</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-nx-text-strong">{mod.title}</span>
                    <span className="text-2xs px-2 py-0.5 rounded-md font-semibold" style={{
                      background: isQuiz ? 'rgba(var(--nx-purple) / 0.1)' : 'var(--nx-accent-muted)',
                      color: isQuiz ? 'rgb(var(--nx-purple))' : 'rgb(var(--nx-accent))',
                    }}>
                      {isQuiz ? 'Assessment' : 'Lesson'}
                    </span>
                    {isCompleted && quizScore !== undefined && (
                      <span className="text-2xs font-mono" style={{ color: quizScore >= 0.8 ? 'rgb(var(--nx-green))' : 'rgb(var(--nx-orange))' }}>
                        {Math.round(quizScore * 100)}%
                      </span>
                    )}
                  </div>
                  {isQuiz && mod.questions && (
                    <div className="text-2xs text-nx-text-muted mt-0.5">{mod.questions.length} questions</div>
                  )}
                </div>

                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgb(var(--nx-text-hint))" strokeWidth="2" strokeLinecap="round" className="group-hover:translate-x-1 transition-transform">
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Main academy overview
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="nx-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-nx-text-strong">Noctis Trading Academy</h2>
            <p className="text-sm text-nx-text-muted mt-1">Interactive Options & Volatility Pricing — from foundations to advanced strategies</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold font-mono text-nx-accent">{overallProgress}%</div>
            <div className="text-2xs text-nx-text-muted">{completedModules}/{totalModules} modules</div>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--nx-glass)' }}>
          <div className="h-full rounded-full transition-all duration-700" style={{
            width: `${overallProgress}%`,
            background: 'linear-gradient(90deg, rgb(var(--nx-accent)), rgb(var(--nx-purple)), rgb(var(--nx-green)))',
            boxShadow: '0 0 12px rgba(var(--nx-accent) / 0.3)',
          }} />
        </div>

        {/* Adaptive speed indicator */}
        <div className="flex items-center gap-3 mt-3">
          <div className="text-2xs text-nx-text-muted">Learning pace:</div>
          <span className="text-2xs px-2 py-0.5 rounded-md font-semibold" style={{
            background: speed === 'accelerated' ? 'var(--nx-green-muted)' : speed === 'reinforced' ? 'var(--nx-orange-muted)' : 'var(--nx-accent-muted)',
            color: speed === 'accelerated' ? 'rgb(var(--nx-green))' : speed === 'reinforced' ? 'rgb(var(--nx-orange))' : 'rgb(var(--nx-accent))',
          }}>
            {speed === 'accelerated' ? '\u26A1 Accelerated — Quiz scores high, advancing faster' :
             speed === 'reinforced' ? '\u{1F504} Review Mode — Extra reinforcement on key concepts' :
             '\u{1F4DA} Standard — Building at a steady pace'}
          </span>
        </div>
      </div>

      {/* Curriculum Units */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CURRICULUM.map((unit, unitIdx) => {
          const unitModules = unit.modules.length
          const unitCompleted = unit.modules.filter(m => progress[m.id]?.completed).length
          const unitProgress = Math.round((unitCompleted / unitModules) * 100)

          return (
            <button
              key={unit.id}
              onClick={() => setSelectedUnit(unit.id)}
              className="nx-card p-5 text-left transition-all duration-200 group"
              style={{ cursor: 'pointer' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{unit.icon}</span>
                <div className="flex-1">
                  <div className="text-xs text-nx-text-muted uppercase tracking-wider font-semibold">Unit {unitIdx + 1}</div>
                  <h3 className="text-base font-bold text-nx-text-strong">{unit.title}</h3>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgb(var(--nx-text-hint))" strokeWidth="2" strokeLinecap="round" className="group-hover:translate-x-1 transition-transform">
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </div>

              <p className="text-sm text-nx-text-muted mb-3">{unit.description}</p>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--nx-glass)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${unitProgress}%`,
                    background: unitProgress === 100 ? 'rgb(var(--nx-green))' : 'rgb(var(--nx-accent))',
                  }} />
                </div>
                <span className="text-2xs font-mono text-nx-text-muted">{unitCompleted}/{unitModules}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Study Tools */}
      <div className="nx-card p-4">
        <div className="nx-section-header">
          <div className="nx-accent-bar" />
          <h3>Study Tools</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          {[
            { label: 'Option Payoff Calculator', icon: '\u{1F4CA}', desc: 'Visualize P&L for any option position' },
            { label: 'Greeks Dashboard', icon: '\u{1F9EE}', desc: 'See how Greeks change in real-time' },
            { label: 'IV Rank Scanner', icon: '\u{1F50D}', desc: 'Find high/low IV opportunities' },
            { label: 'Strategy Builder', icon: '\u{1F3D7}', desc: 'Build and test multi-leg strategies' },
          ].map(tool => (
            <div key={tool.label} className="p-3 rounded-lg text-center" style={{ background: 'var(--nx-glass)', border: '1px solid var(--nx-border)' }}>
              <div className="text-xl mb-1">{tool.icon}</div>
              <div className="text-2xs font-semibold text-nx-text-strong">{tool.label}</div>
              <div className="text-2xs text-nx-text-muted mt-0.5">{tool.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
