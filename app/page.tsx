"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const GAUGE_MIN = -200; // cm
const GAUGE_MAX = 20;   // cm
const GAUGE_RANGE = GAUGE_MAX - GAUGE_MIN; // 220

const TOTAL_ROUNDS = 8;

// Target zone widths per round (cm)
const ZONE_WIDTHS = [60, 50, 40, 32, 25, 20, 16, 12];

// Gauge speed: base 2.5 cm/frame + 0.4 per round
// Converted to % of range per frame at 60fps
const BASE_SPEED_PCT = (2.5 / GAUGE_RANGE) * 100;
const SPEED_INC_PCT = (0.4 / GAUGE_RANGE) * 100;

// Optimal groundwater range for scoring (cm)
const OPTIMAL_MIN = -40;
const OPTIMAL_MAX = -15;

type Season = "dry" | "wet";

function getSeason(round: number): Season {
  return round % 2 === 0 ? "dry" : "wet";
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function calcScore(value: number, zoneMid: number, zoneHalf: number): number {
  const dist = Math.abs(value - zoneMid);
  if (dist <= zoneHalf) {
    // Inside zone: 80–100
    return Math.round(100 - (dist / zoneHalf) * 20);
  }
  const nearBand = zoneHalf * 1.5;
  if (dist <= zoneHalf + nearBand) {
    // Near zone: 30–60
    return Math.round(60 - ((dist - zoneHalf) / nearBand) * 30);
  }
  // Outside: 0–30
  const farBand = GAUGE_RANGE / 3;
  return Math.round(30 - Math.min((dist - zoneHalf - nearBand) / farBand, 1) * 30);
}

// ─── Grade ───────────────────────────────────────────────────────────────────


type Grade =
  | "legendary"
  | "excellent"
  | "good"
  | "normal"
  | "stress"
  | "bad"
  | "severe";

function getGrade(avg: number): Grade {
  if (avg >= 95) return "legendary";
  if (avg >= 85) return "excellent";
  if (avg >= 70) return "good";
  if (avg >= 55) return "normal";
  if (avg >= 40) return "stress";
  if (avg >= 25) return "bad";
  return "severe";
}

const GRADE_INFO: Record<
  Grade,
  { ko: string; en: string; color: string; treatment: string; desc_ko: string; desc_en: string }
> = {
  legendary: {
    ko: "전설적인 생장",
    en: "Legendary Growth",
    color: "#2ecc71",
    treatment: "M1 (-15 cm) 완벽 유지",
    desc_ko: "지하수위를 거의 완벽하게 맞췄습니다! 타마누가 폭발적으로 성장하여 거대한 나무로 자랐습니다.",
    desc_en: "You maintained a nearly perfect groundwater level! The tree grew explosively into a legendary giant.",
  },
  excellent: {
    ko: "탁월한 생장",
    en: "Excellent Growth",
    color: "#6db85c",
    treatment: "M1 (-15 cm) 수준",
    desc_ko: "최적에 가까운 지하수위로 타마누가 매우 건강하게 성장했습니다.",
    desc_en: "The tree grew very healthily with near-optimal groundwater management.",
  },
  good: {
    ko: "양호한 생장",
    en: "Good Growth",
    color: "#c8a84b",
    treatment: "M0–M2 범위",
    desc_ko: "적절한 지하수위로 양호한 생장을 보였습니다.",
    desc_en: "Good growth with generally appropriate groundwater levels.",
  },
  normal: {
    ko: "보통 생장",
    en: "Normal Growth",
    color: "#b0b85c",
    treatment: "M2 수준",
    desc_ko: "평균적인 지하수위 관리로 무난한 생장입니다.",
    desc_en: "Average growth with moderate groundwater management.",
  },
  stress: {
    ko: "스트레스 생장",
    en: "Stressed Growth",
    color: "#e08a4a",
    treatment: "M3 (-5 cm) 수준",
    desc_ko: "지하수위가 다소 불안정해 스트레스를 받았습니다.",
    desc_en: "Growth stress due to somewhat unstable groundwater levels.",
  },
  bad: {
    ko: "불량 생장",
    en: "Poor Growth",
    color: "#e05c4a",
    treatment: "M3~M4 수준",
    desc_ko: "지하수위 관리 실패로 생장이 저조합니다.",
    desc_en: "Poor growth due to failed groundwater management.",
  },
  severe: {
    ko: "심각한 영향",
    en: "Severe Impact",
    color: "#c94f4f",
    treatment: "M4 (0 cm) 수준",
    desc_ko: "지하수위가 극단적으로 잘못되어 타마누가 거의 죽음 직전입니다.",
    desc_en: "Severely negative impact, the tree is near death due to extreme groundwater mismanagement.",
  },
};

// ─── SVG Tamanu Seedling ──────────────────────────────────────────────────────

function TamanuSeedling({ score }: { score: number }) {
  // 0~6단계(7단계)로 stage 세분화, 0:묘목~6:거대한 나무
  const stage = Math.min(6, Math.floor(score / 120));
  const trunkHeight = 30 + stage * 14;
  const leafPairs = 1 + stage;
  const cx = 60;
  const baseY = 140;
  const trunkTop = baseY - trunkHeight;
  // 점수에 따라 잎 색상, 나무 굵기, 열매 등 추가 효과
  const leafColor = stage >= 5 ? "#2ecc71" : stage >= 3 ? "#6db85c" : "#4a7c3f";
  const trunkColor = stage >= 5 ? "#3e2c1a" : "#6b4c2a";
  const fruitColor = stage === 6 ? "#f5c842" : undefined;

  const leaves: React.ReactNode[] = [];
  for (let i = 0; i < leafPairs; i++) {
    const y = trunkTop + i * (trunkHeight / (leafPairs + 0.5));
    const size = 10 + stage * 2.5 - i * 1.2;
    leaves.push(
      <ellipse key={`l${i}`} cx={cx - size * 0.8} cy={y} rx={size} ry={size * 0.45}
        fill={leafColor} opacity={0.9} transform={`rotate(-25, ${cx - size * 0.8}, ${y})`} />,
      <ellipse key={`r${i}`} cx={cx + size * 0.8} cy={y} rx={size} ry={size * 0.45}
        fill={leafColor} opacity={0.9} transform={`rotate(25, ${cx + size * 0.8}, ${y})`} />
    );
  }
  // 꼭대기 잎
  leaves.push(
    <ellipse key="top" cx={cx} cy={trunkTop - 8} rx={12 + stage * 2} ry={7 + stage}
      fill={leafColor} opacity={0.95} />
  );
  // stage 6(최고점)에는 열매 추가
  const fruits = stage === 6
    ? [
        <circle key="fruit1" cx={cx - 18} cy={trunkTop + 18} r={5} fill={fruitColor} opacity={0.85} />,
        <circle key="fruit2" cx={cx + 16} cy={trunkTop + 22} r={4} fill={fruitColor} opacity={0.7} />,
        <circle key="fruit3" cx={cx} cy={trunkTop + 8} r={4.5} fill={fruitColor} opacity={0.8} />,
      ]
    : null;

  return (
    <svg viewBox="0 0 120 160" className="w-full h-full" aria-label="타마누 묘목">
      <rect x={38} y={baseY} width={44} height={16} rx={3} fill="#7a5c3a" />
      <rect x={34} y={baseY - 2} width={52} height={7} rx={2} fill="#8a6c4a" />
      <rect x={cx - (stage >= 5 ? 7 : 4)} y={trunkTop} width={stage >= 5 ? 14 : 8} height={trunkHeight} rx={stage >= 5 ? 5 : 3} fill={trunkColor} />
      {leaves}
      {fruits}
    </svg>
  );
}

// ─── Season Icon ──────────────────────────────────────────────────────────────

function SeasonIcon({ season }: { season: Season }) {
  if (season === "dry") {
    return (
      <svg viewBox="0 0 32 32" className="w-6 h-6" aria-label="건기">
        <circle cx={16} cy={16} r={7} fill="#f5c842" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line key={deg}
              x1={16 + 9 * Math.cos(rad)} y1={16 + 9 * Math.sin(rad)}
              x2={16 + 13 * Math.cos(rad)} y2={16 + 13 * Math.sin(rad)}
              stroke="#f5c842" strokeWidth={2} strokeLinecap="round" />
          );
        })}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className="w-6 h-6" aria-label="우기">
      <ellipse cx={16} cy={13} rx={9} ry={7} fill="#7ab0d8" />
      <ellipse cx={10} cy={16} rx={6} ry={5} fill="#7ab0d8" />
      <ellipse cx={22} cy={15} rx={5} ry={4} fill="#7ab0d8" />
      <ellipse cx={16} cy={17} rx={11} ry={5} fill="#a0c8e8" />
      {[10, 16, 22].map((x) => (
        <line key={x} x1={x} y1={22} x2={x - 2} y2={28}
          stroke="#5a90c8" strokeWidth={2} strokeLinecap="round" />
      ))}
    </svg>
  );
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

function Gauge({ value, zoneMin, zoneMax }: { value: number; zoneMin: number; zoneMax: number }) {
  const toPct = (v: number) => ((v - GAUGE_MIN) / GAUGE_RANGE) * 100;

  const indPct = toPct(value);
  const zoneBotPct = toPct(zoneMin);
  const zoneHeightPct = toPct(zoneMax) - zoneBotPct;

  const ticks = [-200, -150, -100, -50, 0, 20];

  return (
    <div
      className="relative w-full h-full rounded-xl overflow-hidden select-none"
      style={{
        background: "linear-gradient(to top, #082a38, #0d5060, #1a8090, #0d5060, #082a38)",
      }}
    >
      {/* Optimal zone faint marker */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: `${toPct(OPTIMAL_MIN)}%`,
          height: `${toPct(OPTIMAL_MAX) - toPct(OPTIMAL_MIN)}%`,
          background: "rgba(100,200,100,0.08)",
          borderTop: "1px dashed rgba(100,200,100,0.3)",
          borderBottom: "1px dashed rgba(100,200,100,0.3)",
        }}
      />

      {/* Target zone */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: `${zoneBotPct}%`,
          height: `${zoneHeightPct}%`,
          background: "rgba(80,200,80,0.28)",
          borderTop: "2px solid #6db85c",
          borderBottom: "2px solid #6db85c",
        }}
      />

      {/* Tick marks */}
      {ticks.map((tick) => (
        <div
          key={tick}
          className="absolute left-0"
          style={{ bottom: `${toPct(tick)}%`, display: "flex", alignItems: "center" }}
        >
          <div style={{ width: "8px", height: "1px", background: "rgba(180,220,220,0.4)" }} />
        </div>
      ))}

      {/* Indicator line */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: `${indPct}%`,
          transform: "translateY(50%)",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <div style={{ width: "100%", height: "2px", background: "#c8a84b" }} />
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 0,
            height: 0,
            borderTop: "5px solid transparent",
            borderBottom: "5px solid transparent",
            borderLeft: "8px solid #c8a84b",
          }}
        />
      </div>
    </div>
  );
}

// ─── Round Tile ───────────────────────────────────────────────────────────────

function RoundTile({ round, score, current }: { round: number; score?: number; current?: boolean }) {
  const bg =
    score === undefined
      ? current
        ? "rgba(200,168,75,0.2)"
        : "rgba(255,255,255,0.05)"
      : score >= 80
      ? "rgba(80,180,80,0.3)"
      : score >= 50
      ? "rgba(200,168,75,0.3)"
      : "rgba(180,80,80,0.3)";

  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg gap-0.5"
      style={{
        background: bg,
        border: current ? "1px solid #c8a84b" : "1px solid rgba(255,255,255,0.08)",
        minWidth: "38px",
        height: "52px",
        padding: "4px 6px",
      }}
    >
      <div style={{ fontSize: "9px", color: "#6a8a6a", lineHeight: 1 }}>R{round}</div>
      <div style={{ fontSize: "15px", fontWeight: "bold", color: "#e8f0e8", lineHeight: 1 }}>
        {score !== undefined ? score : current ? "?" : "·"}
      </div>
      <SeasonIcon season={getSeason(round - 1)} />
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = "intro" | "game" | "result";

interface RoundResult {
  score: number;
  value: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [gaugeValue, setGaugeValue] = useState(-100);
  const [frozen, setFrozen] = useState(false);
  const [flashScore, setFlashScore] = useState<number | null>(null);
  const [showResearch, setShowResearch] = useState(false);

  const animRef = useRef<number | null>(null);
  const gaugeRef = useRef(-100);
  const dirRef = useRef(1);
  const frozenRef = useRef(false);
  const roundRef = useRef(0);

  // Zone calculation
  const zoneWidth = ZONE_WIDTHS[round] ?? ZONE_WIDTHS[ZONE_WIDTHS.length - 1];
  const zoneHalf = zoneWidth / 2;
  const zoneCenter = OPTIMAL_MIN + (OPTIMAL_MAX - OPTIMAL_MIN) / 2 + ((round * 5) % 10) - 5;
  const zoneMin = zoneCenter - zoneHalf;
  const zoneMax = zoneCenter + zoneHalf;

  const speedPct = BASE_SPEED_PCT + SPEED_INC_PCT * round;

  // Sync refs
  gaugeRef.current = gaugeValue;
  frozenRef.current = frozen;
  roundRef.current = round;

  // Animation loop (stable — no deps on round/speed to avoid restarts)
  const speedRef = useRef(speedPct);
  speedRef.current = speedPct;

  const animate = useCallback(() => {
    if (frozenRef.current) return;
    setGaugeValue((prev) => {
      let next = prev + dirRef.current * speedRef.current;
      if (next >= GAUGE_MAX) {
        next = GAUGE_MAX;
        dirRef.current = -1;
      } else if (next <= GAUGE_MIN) {
        next = GAUGE_MIN;
        dirRef.current = 1;
      }
      gaugeRef.current = next;
      return next;
    });
    animRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (screen !== "game" || frozen) return;
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [screen, frozen, animate]);

  // Zone refs for handleAction closure
  const zoneCenterRef = useRef(zoneCenter);
  const zoneHalfRef = useRef(zoneHalf);
  const zoneMinRef = useRef(zoneMin);
  const zoneMaxRef = useRef(zoneMax);
  zoneCenterRef.current = zoneCenter;
  zoneHalfRef.current = zoneHalf;
  zoneMinRef.current = zoneMin;
  zoneMaxRef.current = zoneMax;

  const handleAction = useCallback(() => {
    if (screen === "intro") {
      // Reset all state
      setRound(0);
      roundRef.current = 0;
      setResults([]);
      const startVal = -100;
      setGaugeValue(startVal);
      gaugeRef.current = startVal;
      dirRef.current = 1;
      setFrozen(false);
      frozenRef.current = false;
      setScreen("game");
      return;
    }

    if (screen === "result") {
      setScreen("intro");
      setShowResearch(false);
      return;
    }

    if (screen !== "game" || frozen) return;

    // Freeze
    setFrozen(true);
    frozenRef.current = true;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const val = gaugeRef.current;
    const sc = calcScore(val, zoneCenterRef.current, zoneHalfRef.current);
    setFlashScore(sc);

    setTimeout(() => {
      setFlashScore(null);
      const newResult: RoundResult = { score: sc, value: Math.round(val) };

      setResults((prev) => {
        const updated = [...prev, newResult];
        const nextRound = roundRef.current + 1;

        if (nextRound >= TOTAL_ROUNDS) {
          setScreen("result");
        } else {
          setRound(nextRound);
          roundRef.current = nextRound;
          const startVal = nextRound % 2 === 0 ? GAUGE_MIN + 10 : GAUGE_MAX - 5;
          setGaugeValue(startVal);
          gaugeRef.current = startVal;
          dirRef.current = nextRound % 2 === 0 ? 1 : -1;
          setFrozen(false);
          frozenRef.current = false;
        }

        return updated;
      });
    }, 1400);
  }, [screen, frozen]);

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handleAction();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleAction]);

  const totalScore = results.reduce((s, r) => s + r.score, 0);
  const avgScore = results.length > 0 ? Math.round(totalScore / results.length) : 0;
  const grade = getGrade(avgScore);
  const gradeInfo = GRADE_INFO[grade];

  // ── Intro ────────────────────────────────────────────────────────────────────
  if (screen === "intro") {
    return (
      <main
        className="flex flex-col items-center justify-between h-dvh w-full cursor-pointer select-none overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0d1f0d 0%, #1a3a1a 60%, #0d2a1a 100%)" }}
        onClick={handleAction}
        onTouchStart={(e) => { e.preventDefault(); handleAction(); }}
      >
        <div className="flex flex-col items-center pt-10 px-6 gap-3">
          <div style={{ color: "#6db85c", fontSize: "12px", letterSpacing: "0.15em", fontWeight: "bold" }}>
            NIFoS · UNSRI 공동연구
          </div>
          <h1 style={{ color: "#e8f0e8", fontSize: "34px", fontWeight: "bold", lineHeight: 1.15, textAlign: "center" }}>
            타마누를<br />살려라
          </h1>
          <p style={{ color: "#a8c0a8", fontSize: "13px" }}>Calophyllum inophyllum</p>
          <div style={{ width: "120px", height: "150px" }}>
            <TamanuSeedling score={520} />
          </div>
        </div>

        <div
          className="mx-5 rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <p style={{ color: "#c8a84b", fontSize: "14px", fontWeight: "bold", textAlign: "center", marginBottom: "10px" }}>
            게임 방법
          </p>
          <ul style={{ color: "#e8f0e8", fontSize: "13px", lineHeight: 1.7, listStyle: "none", padding: 0 }}>
            <li>· 세로 게이지가 위아래로 움직입니다</li>
            <li>· <span style={{ color: "#6db85c", fontWeight: "bold" }}>초록 구간</span>에 금색 인디케이터가 오면 화면을 탭하세요</li>
            <li>· 8라운드, 건기와 우기를 교대로 진행</li>
            <li>· 중심에 가까울수록 높은 점수 (최대 100점)</li>
          </ul>
          <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#a8c0a8" }}>
              <SeasonIcon season="dry" /> 건기
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#a8c0a8" }}>
              <SeasonIcon season="wet" /> 우기
            </div>
          </div>
        </div>

        <div style={{ paddingBottom: "40px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              padding: "12px 32px",
              borderRadius: "9999px",
              background: "linear-gradient(135deg, #4a7c3f, #6db85c)",
              color: "#e8f0e8",
              fontSize: "16px",
              fontWeight: "bold",
              boxShadow: "0 4px 20px rgba(80,180,80,0.3)",
            }}
          >
            화면을 탭해서 시작
          </div>
          <p style={{ color: "#6a8a6a", fontSize: "11px" }}>Space / Enter 키도 사용 가능</p>
        </div>
      </main>
    );
  }

  // ── Game ─────────────────────────────────────────────────────────────────────
  if (screen === "game") {
    const season = getSeason(round);
    return (
      <main
        className="flex flex-col h-dvh w-full overflow-hidden select-none"
        style={{ background: "linear-gradient(180deg, #0d1f0d 0%, #1a2f1a 100%)" }}
        onClick={handleAction}
        onTouchStart={(e) => { e.preventDefault(); handleAction(); }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px 8px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <SeasonIcon season={season} />
            <span style={{ color: "#a8c0a8", fontSize: "13px" }}>{season === "dry" ? "건기" : "우기"}</span>
          </div>
          <div>
            <span style={{ color: "#c8a84b", fontSize: "20px", fontWeight: "bold" }}>Round {round + 1}</span>
            <span style={{ color: "#6a8a6a", fontSize: "13px" }}> / {TOTAL_ROUNDS}</span>
          </div>
          <div style={{ color: "#a8c0a8", fontSize: "12px" }}>
            목표 <span style={{ color: "#6db85c", fontWeight: "bold" }}>{zoneWidth}cm</span>
          </div>
        </div>

        {/* Round tiles */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            padding: "8px 12px",
            justifyContent: "center",
            flexShrink: 0,
            overflowX: "auto",
          }}
        >
          {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
            <RoundTile key={i} round={i + 1} score={results[i]?.score} current={i === round} />
          ))}
        </div>

        {/* Game area */}
        <div
          style={{
            display: "flex",
            flex: 1,
            minHeight: 0,
            padding: "8px 16px 12px",
            gap: "16px",
            alignItems: "stretch",
          }}
        >
          {/* Axis labels */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "4px 0",
              flexShrink: 0,
              width: "36px",
            }}
          >
            {["+20", "0", "-100", "-200"].map((label) => (
              <div key={label} style={{ fontSize: "10px", color: "#6a8a6a", textAlign: "right" }}>
                {label}
              </div>
            ))}
          </div>

          {/* Gauge bar */}
          <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, width: "52px" }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Gauge value={gaugeValue} zoneMin={zoneMin} zoneMax={zoneMax} />
            </div>
            <div style={{ textAlign: "center", marginTop: "4px", color: "#c8a84b", fontSize: "13px", fontWeight: "bold" }}>
              {Math.round(gaugeValue)} cm
            </div>
          </div>

          {/* Seedling + UI */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
            {/* Flash score */}
            {flashScore !== null && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  fontSize: "52px",
                  fontWeight: "bold",
                  color: flashScore >= 80 ? "#6db85c" : flashScore >= 50 ? "#c8a84b" : "#c94f4f",
                  textShadow: "0 2px 12px rgba(0,0,0,0.8)",
                  zIndex: 20,
                  animation: "fadeUp 1.4s ease-out forwards",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {flashScore}
              </div>
            )}

            {/* Seedling */}
            <div style={{ width: "100%", maxWidth: "110px", aspectRatio: "3/4" }}>
              <TamanuSeedling score={totalScore} />
            </div>
            <div style={{ color: "#a8c0a8", fontSize: "12px", marginTop: "4px" }}>
              총 {totalScore}점
            </div>

            {/* Tap hint */}
            {!frozen && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "8px 20px",
                  borderRadius: "9999px",
                  background: "rgba(200,168,75,0.12)",
                  border: "1px solid rgba(200,168,75,0.35)",
                  color: "#c8a84b",
                  fontSize: "13px",
                }}
              >
                탭하여 멈추기
              </div>
            )}

            {/* Frozen message */}
            {frozen && flashScore === null && (
              <div style={{ marginTop: "12px", color: "#6a8a6a", fontSize: "12px" }}>
                다음 라운드 준비 중...
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes fadeUp {
            0%   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            60%  { opacity: 1; transform: translate(-50%, -65%) scale(1.2); }
            100% { opacity: 0; transform: translate(-50%, -80%) scale(0.9); }
          }
        `}</style>
      </main>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────────
  return (
    <main
      className="h-dvh w-full overflow-y-auto"
      style={{ background: "linear-gradient(180deg, #0d1f0d 0%, #1a2f1a 100%)" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "28px 16px 40px",
          gap: "16px",
          maxWidth: "420px",
          margin: "0 auto",
        }}
      >
        {/* Seedling */}
        <div style={{ width: "100px", height: "130px" }}>
          <TamanuSeedling score={totalScore} />
        </div>

        {/* Grade badge */}
        <div style={{ textAlign: "center" }}>
          <div style={{ color: gradeInfo.color, fontSize: "28px", fontWeight: "bold", lineHeight: 1.2 }}>
            {gradeInfo.ko}
          </div>
          <div style={{ color: "#a8c0a8", fontSize: "14px" }}>{gradeInfo.en}</div>
          <div style={{ color: "#6a8a6a", fontSize: "12px", marginTop: "4px" }}>{gradeInfo.treatment}에 해당</div>
        </div>

        {/* Score summary */}
        <div
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ color: "#a8c0a8", fontSize: "12px" }}>평균 점수</div>
          <div style={{ color: "#c8a84b", fontSize: "44px", fontWeight: "bold", lineHeight: 1.1 }}>{avgScore}</div>
          <div style={{ color: "#a8c0a8", fontSize: "12px" }}>총 {totalScore}점 (8라운드)</div>
        </div>

        {/* Round tiles */}
        <div style={{ width: "100%" }}>
          <div style={{ color: "#6a8a6a", fontSize: "11px", marginBottom: "6px" }}>라운드별 결과</div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
            {results.map((r, i) => (
              <RoundTile key={i} round={i + 1} score={r.score} />
            ))}
          </div>
        </div>

        {/* Description */}
        <div
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "16px",
          }}
        >
          <p style={{ color: "#e8f0e8", fontSize: "13px", lineHeight: 1.75, margin: 0 }}>{gradeInfo.desc_ko}</p>
          <p style={{ color: "#a8c0a8", fontSize: "12px", lineHeight: 1.6, margin: "8px 0 0", fontStyle: "italic" }}>
            {gradeInfo.desc_en}
          </p>
        </div>

        {/* Research toggle */}
        <div style={{ width: "100%" }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowResearch((v) => !v); }}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#a8c0a8",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
              minHeight: "44px",
              fontFamily: "inherit",
            }}
          >
            {showResearch ? "연구 배경 닫기" : "연구 배경 보기"}
          </button>

          {showResearch && (
            <div
              style={{
                marginTop: "8px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                padding: "14px",
              }}
            >
              <p style={{ color: "#6db85c", fontSize: "13px", fontWeight: "bold", marginBottom: "8px" }}>
                NIFoS-UNSRI 공동연구 개요
              </p>
              <ul style={{ color: "#a8c0a8", fontSize: "12px", lineHeight: 1.7, listStyle: "none", padding: 0, margin: 0 }}>
                <li>· 인도네시아 열대 이탄지 타마누(Calophyllum inophyllum) 용기묘 지하수위별 생장 실험</li>
                <li>· 5개 처리구: M0(대조군), M1(-15 cm), M2(-10 cm), M3(-5 cm), M4(0 cm)</li>
                <li>· 모든 처리구 생존율 <span style={{ color: "#e8f0e8", fontWeight: "bold" }}>100%</span></li>
                <li>· M3·M4: 수고·잎수·근원경 유의하게 감소 (p&lt;0.05)</li>
                <li>· 최적 지하수위: <span style={{ color: "#6db85c", fontWeight: "bold" }}>-40 ~ -15 cm</span></li>
                <li>· 이탄지 훼손 방지 + 생장 최적화 동시 달성 가능</li>
              </ul>
            </div>
          )}
        </div>

        {/* Replay button */}
        <button
          onClick={() => { setScreen("intro"); setShowResearch(false); }}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #4a7c3f, #6db85c)",
            color: "#e8f0e8",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: "pointer",
            minHeight: "52px",
            boxShadow: "0 4px 20px rgba(80,180,80,0.25)",
            fontFamily: "inherit",
            border: "none",
          }}
        >
          다시 하기
        </button>
      </div>
    </main>
  );
}
