import type { SciId } from '../coaching/hypertrophy'

export interface Cite { text: string; url?: string }
export interface Principle {
  id: SciId
  title: string
  /** what ARLog does with this */
  rule: string
  /** what the research found, stated as plainly and carefully as possible */
  evidence: string
  /** honest limits */
  caveat: string
  confidence: 'Well supported' | 'Fairly supported' | 'Rule of thumb'
  cites: Cite[]
}

/**
 * Summaries of the research behind ARLog's coaching rules. They were checked against paper abstracts and
 * review articles while building the app, but they are plain-language summaries by the app's author, not
 * medical or coaching advice. Where a number is a practical choice rather than a study result, it says so.
 */
export const PRINCIPLES: Principle[] = [
  {
    id: 'volume', title: 'How many sets per muscle each week', confidence: 'Well supported',
    rule: 'Your goal sets a weekly range for each muscle: Priority 14–22, Standard 10–16, Maintain 5–9 hard sets. A primary muscle counts as 1 set, a secondary muscle as 0.5. The coach flags muscles that average below their range and suggests adding sets.',
    evidence: 'Meta-analyses find that more weekly sets generally means more muscle growth, with diminishing returns. Schoenfeld, Ogborn & Krieger (2017) reported a graded dose-response relationship. A larger meta-regression preprint (Pelland et al., 2024) found growth keeps rising but tapers, with no detectable extra benefit beyond roughly 31 "fractional" sets per week.',
    caveat: 'The best number varies by person, muscle and how well you recover, and the exact figures above are cautious practical choices, not hard limits. The 0.5-set credit for secondary muscles is a convention, not a measurement. Pelland et al. is a preprint.',
    cites: [
      { text: 'Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. J Sports Sci. 2017.' },
      { text: 'Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. The resistance training dose-response: meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gain (SportRxiv preprint).', url: 'https://sportrxiv.org/index.php/server/preprint/download/537/1148/1071' },
    ],
  },
  {
    id: 'effort', title: 'How hard each set should be', confidence: 'Fairly supported',
    rule: 'Aim to finish hard sets with roughly 0–3 reps left. If you log RPE and your sets average below 7, the coach suggests adding weight or reps. You never need to train to failure.',
    evidence: 'Refalo et al. (2023) pooled 15 studies and found no evidence that training to momentary failure beats stopping short of it for muscle growth; only some definitions of "failure" showed a trivial edge. In short, sets need to be challenging, but grinding to failure is not required.',
    caveat: 'People tend to misjudge how many reps they have left, though accuracy improves with practice (especially on simpler, isolation exercises).',
    cites: [{ text: 'Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ. Influence of resistance training proximity-to-failure on skeletal muscle hypertrophy: a systematic review with meta-analysis. Sports Med. 2023;53(3):649–665.', url: 'https://scholars.duke.edu/publication/1687483' }],
  },
  {
    id: 'load', title: 'Rep ranges and weight', confidence: 'Fairly supported',
    rule: 'Most of your sets can sit anywhere from about 6 to 15 reps. The coach only speaks up when your typical reps are very high (about 20 or more, so a heavier weight would be more efficient) or very low (3 or fewer).',
    evidence: 'Schoenfeld, Wilson, Lowery & Krieger (2016) found muscle growth was similar with heavier and lighter loads (the difference was not statistically significant) while strength favoured heavier loads. Loads at or below about 50% of your max could still produce substantial growth when sets were taken close to failure.',
    caveat: 'The 20 and 3 rep cut-offs are practical rules of thumb, not study results. Very high-rep sets are uncomfortable and slow, which is the main reason not to live there.',
    cites: [{ text: 'Schoenfeld BJ, Wilson JM, Lowery RP, Krieger JW. Muscular adaptations in low- versus high-load resistance training: a meta-analysis. Eur J Sport Sci. 2016;16(1):1–10.' }],
  },
  {
    id: 'rest', title: 'Rest between sets', confidence: 'Rule of thumb',
    rule: 'If your reps drop steeply across sets at the same weight (for example 12, 9, 7), the coach suggests resting 2–3 minutes or using a slightly lighter weight.',
    evidence: 'A study in resistance-trained men (Schoenfeld et al., 2016) titled "Longer interset rest periods enhance muscle strength and hypertrophy" compared longer and shorter rests and favoured longer. A steep rep drop-off is a simple sign you are starting the next set under-recovered.',
    caveat: 'This is one fairly small study. Shorter rests can work when total sets are sufficient, so treat this as a tip, not a rule.',
    cites: [{ text: 'Schoenfeld BJ, Pope ZK, Benik FM, et al. Longer interset rest periods enhance muscle strength and hypertrophy in resistance-trained men. J Strength Cond Res. 2016;30(7):1805–1812.' }],
  },
  {
    id: 'frequency', title: 'How often to train a muscle', confidence: 'Fairly supported',
    rule: 'ARLog does not force a frequency. If nearly all of a muscle\'s weekly sets land in one session, it suggests spreading them across two.',
    evidence: 'An early meta-analysis (Schoenfeld et al., 2016) found higher frequencies looked better, but could not separate frequency from volume. A later meta-analysis (Schoenfeld, Grgic & Krieger, 2019) found no significant difference between frequencies when weekly volume was equated. Frequency mainly matters because it makes a given weekly volume easier to do well.',
    caveat: 'When volume is not matched, higher frequencies do tend to come out ahead, which is partly why splitting big weekly totals across days is practical advice.',
    cites: [
      { text: 'Schoenfeld BJ, Ogborn D, Krieger JW. Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis. Sports Med. 2016;46(11):1689–1697.', url: 'https://pubmed.ncbi.nlm.nih.gov/27102172/' },
      { text: 'Schoenfeld BJ, Grgic J, Krieger J. How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis of studies examining the effects of resistance training frequency. J Sports Sci. 2019.', url: 'https://www.pubmed.gov/30558493/' },
    ],
  },
  {
    id: 'session', title: 'Sets per session', confidence: 'Rule of thumb',
    rule: 'If a single workout stacks more than about 10 hard sets onto one muscle, the coach suggests moving some to another day.',
    evidence: 'Trials have not established a firm per-session cutoff. The advice follows from diminishing returns on each additional set, plus the frequency findings above: splitting a large weekly dose lets every set be a good one.',
    caveat: 'Limited direct evidence. Treat the number 10 as a sensible guard-rail, not a study result.',
    cites: [],
  },
  {
    id: 'maintenance', title: 'Maintaining muscle with less', confidence: 'Fairly supported',
    rule: 'Muscles you set to "Maintain" get a smaller range (5–9 sets), because far less training than building takes is enough to hold on to what you have. The coach may suggest trimming a low-priority muscle that is getting much more than that.',
    evidence: 'In Bickel, Cross & Bamman (2011), people trained for 16 weeks, then cut their training to one-third or one-ninth of the dose for 32 weeks; both preserved muscle growth in the young adults. A review by Spiering et al. (2021) concludes strength and size can be maintained for up to 32 weeks with as little as one session a week and one set per exercise, as long as the relative load stays high.',
    caveat: 'Preserving is not growing. Older adults appear to need more. The review\'s "one set" figure is an extrapolation from the literature, not a direct test, and intensity (weight on the bar) must stay up.',
    cites: [
      { text: 'Bickel CS, Cross JM, Bamman MM. Exercise dosing to retain resistance training adaptations in young and older adults. Med Sci Sports Exerc. 2011;43(7):1177–1187.' },
      { text: 'Spiering BA, Mujika I, Sharp MA, Foulis SA. Maintaining physical performance: the minimal dose of exercise needed to preserve endurance and strength over time. J Strength Cond Res. 2021.', url: 'https://pubmed.ncbi.nlm.nih.gov/33629972/' },
    ],
  },
]

export const principle = (id: SciId) => PRINCIPLES.find((p) => p.id === id)!
