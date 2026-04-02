import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash, ChatBubble } from '../assets/icons'
import icon from '../assets/icon.png'

interface ProfileInfo {
  name: string
  path: string
  isDefault: boolean
  isActive: boolean
  model: string
  provider: string
  hasEnv: boolean
  hasSoul: boolean
  skillCount: number
  gatewayRunning: boolean
}

interface AgentsProps {
  activeProfile: string
  onSelectProfile: (name: string) => void
  onChatWith: (name: string) => void
}

type Tab = 'interactive' | 'manage'

/* ──────────────────────────────────────────────────────
   Robot color palettes — deterministic by name
   ────────────────────────────────────────────────────── */
const ROBOT_PALETTES = [
  { body: '#E8734A', accent: '#D45A33', eye: '#2D2D2D', highlight: '#F4A261' },
  { body: '#4AADE8', accent: '#338BC2', eye: '#2D2D2D', highlight: '#7DD3FC' },
  { body: '#E8C94A', accent: '#D4B033', eye: '#2D2D2D', highlight: '#FDE68A' },
  { body: '#E84A7A', accent: '#D4336A', eye: '#2D2D2D', highlight: '#FDA4AF' },
  { body: '#4AE8A8', accent: '#33D48E', eye: '#2D2D2D', highlight: '#86EFAC' },
  { body: '#A84AE8', accent: '#9233D4', eye: '#2D2D2D', highlight: '#D8B4FE' },
  { body: '#E8884A', accent: '#D47033', eye: '#2D2D2D', highlight: '#FDBA74' },
  { body: '#4AE8E8', accent: '#33D4D4', eye: '#2D2D2D', highlight: '#67E8F9' },
]

function getPalette(name: string): (typeof ROBOT_PALETTES)[0] {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return ROBOT_PALETTES[Math.abs(hash) % ROBOT_PALETTES.length]
}

/* ──────────────────────────────────────────────────────
   SVG building blocks for the office
   ────────────────────────────────────────────────────── */

function Robot({ x, y, palette: p, scale = 1, isActive = false }: { x: number; y: number; palette: (typeof ROBOT_PALETTES)[0]; scale?: number; isActive?: boolean }): React.JSX.Element {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* Antenna */}
      <line x1="0" y1="-48" x2="0" y2="-58" stroke={p.accent} strokeWidth="2" />
      <circle cx="0" cy="-60" r="3" fill={p.highlight}>
        {isActive && (
          <animate attributeName="r" values="3;4.5;3" dur="1.5s" repeatCount="indefinite" />
        )}
      </circle>
      {isActive && (
        <circle cx="0" cy="-60" r="6" fill={p.highlight} opacity="0">
          <animate attributeName="opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="r" values="4;8;4" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Head — subtle bob when active */}
      <g>
        {isActive && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0;0,-1.2;0,0"
            dur="3s"
            repeatCount="indefinite"
          />
        )}
        <rect x="-15" y="-48" width="30" height="24" rx="7" fill={p.body} />

        {/* Eyes — white sclera */}
        <circle cx="-6" cy="-36" r="4.5" fill="#fff" />
        <circle cx="6" cy="-36" r="4.5" fill="#fff" />

        {/* Pupils — smooth rolling when active, static otherwise */}
        {isActive ? (
          <>
            <circle cx="-6" cy="-36" r="2.2" fill={p.eye}>
              <animate attributeName="cx" values="-6;-4.5;-6;-7.5;-6;-5;-7;-6" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1" />
              <animate attributeName="cy" values="-36;-35;-36;-35.5;-37;-36;-35.5;-36" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1" />
            </circle>
            <circle cx="6" cy="-36" r="2.2" fill={p.eye}>
              <animate attributeName="cx" values="6;7.5;6;4.5;6;7;5;6" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1" />
              <animate attributeName="cy" values="-36;-35;-36;-35.5;-37;-36;-35.5;-36" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1" />
            </circle>
            {/* Eye shine follows pupils */}
            <circle cx="-5" cy="-37" r="1" fill="#fff" opacity="0.7">
              <animate attributeName="cx" values="-5;-3.5;-5;-6.5;-5;-4;-6;-5" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1" />
              <animate attributeName="cy" values="-37;-36;-37;-36.5;-38;-37;-36.5;-37" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1" />
            </circle>
            <circle cx="7" cy="-37" r="1" fill="#fff" opacity="0.7">
              <animate attributeName="cx" values="7;8.5;7;5.5;7;8;6;7" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1" />
              <animate attributeName="cy" values="-37;-36;-37;-36.5;-38;-37;-36.5;-37" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1" />
            </circle>
          </>
        ) : (
          <>
            <circle cx="-5.5" cy="-35.5" r="2.2" fill={p.eye} />
            <circle cx="6.5" cy="-35.5" r="2.2" fill={p.eye} />
            <circle cx="-4.5" cy="-37" r="1" fill="#fff" opacity="0.7" />
            <circle cx="7.5" cy="-37" r="1" fill="#fff" opacity="0.7" />
          </>
        )}

        {/* Mouth */}
        <path d={`M-5 -28 Q0 -23 5 -28`} stroke={p.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </g>

      {/* Body */}
      <rect x="-13" y="-22" width="26" height="28" rx="5" fill={p.body} />
      {/* Chest panel */}
      <rect x="-7" y="-17" width="14" height="10" rx="2.5" fill={p.accent} />
      <circle cx="0" cy="-12" r="2.5" fill={p.highlight}>
        {isActive ? (
          <animate attributeName="opacity" values="1;0.3;1;0.3;1" dur="1.2s" repeatCount="indefinite" />
        ) : (
          <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
        )}
      </circle>
      {/* Extra status LEDs when active */}
      {isActive && (
        <>
          <circle cx="-3" cy="-9" r="1.2" fill="#4ADE80">
            <animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="3" cy="-9" r="1.2" fill="#60A5FA">
            <animate attributeName="opacity" values="1;0;1" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* Arms */}
      <rect x="-22" y="-18" width="9" height="5" rx="2.5" fill={p.body} />
      <rect x="13" y="-18" width="9" height="5" rx="2.5" fill={p.body} />

      {/* Forearms — typing motion when active */}
      <g>
        {isActive && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0;0,-1.5;0,0;0,-0.5;0,0"
            dur="0.6s"
            repeatCount="indefinite"
          />
        )}
        <rect x="-26" y="-15" width="6" height="18" rx="3" fill={p.body} opacity="0.8" />
        <circle cx="-23" cy="5" r="3.5" fill={p.highlight} />
      </g>
      <g>
        {isActive && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0;0,-0.5;0,0;0,-1.5;0,0"
            dur="0.6s"
            repeatCount="indefinite"
          />
        )}
        <rect x="20" y="-15" width="6" height="18" rx="3" fill={p.body} opacity="0.8" />
        <circle cx="23" cy="5" r="3.5" fill={p.highlight} />
      </g>
    </g>
  )
}

function ManagerDesk({ x, y }: { x: number; y: number }): React.JSX.Element {
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Desk surface */}
      <rect x="-70" y="0" width="140" height="50" rx="4" fill="var(--of-desk)" />
      {/* Desk top edge */}
      <rect x="-72" y="-2" width="144" height="6" rx="2" fill="var(--of-desk-top)" />
      {/* Legs */}
      <rect x="-64" y="48" width="6" height="18" rx="1" fill="var(--of-desk-leg)" />
      <rect x="58" y="48" width="6" height="18" rx="1" fill="var(--of-desk-leg)" />
      {/* Monitor */}
      <rect x="-28" y="-40" width="56" height="36" rx="3" fill="var(--of-monitor)" />
      <rect x="-25" y="-37" width="50" height="30" rx="2" fill="var(--of-screen)" />
      {/* Screen content */}
      <rect x="-20" y="-32" width="22" height="2" rx="1" fill="var(--of-screen-text)" opacity="0.7" />
      <rect x="-20" y="-27" width="34" height="2" rx="1" fill="var(--of-screen-text)" opacity="0.4" />
      <rect x="-20" y="-22" width="18" height="2" rx="1" fill="var(--of-screen-text)" opacity="0.6" />
      <rect x="-20" y="-17" width="28" height="2" rx="1" fill="var(--of-screen-text)" opacity="0.3" />
      {/* Monitor stand */}
      <rect x="-5" y="-4" width="10" height="6" rx="1" fill="var(--of-monitor)" />
      <rect x="-10" y="0" width="20" height="3" rx="1" fill="var(--of-monitor)" />
      {/* Keyboard */}
      <rect x="-18" y="8" width="36" height="10" rx="2" fill="var(--of-keyboard)" />
      <rect x="-15" y="10" width="30" height="6" rx="1" fill="var(--of-keyboard-keys)" opacity="0.3" />
      {/* Coffee mug */}
      <rect x="38" y="2" width="12" height="14" rx="3" fill="var(--of-mug)" />
      <path d="M50 6 Q56 9 50 12" stroke="var(--of-mug)" strokeWidth="2" fill="none" />
      {/* Steam */}
      <path d="M42 -2 Q43 -7 44 -2" stroke="var(--of-steam)" strokeWidth="1" opacity="0.3">
        <animate attributeName="d" values="M42 -2 Q43 -7 44 -2;M42 -4 Q43 -9 44 -4;M42 -2 Q43 -7 44 -2" dur="2s" repeatCount="indefinite" />
      </path>
      <path d="M46 -1 Q47 -6 48 -1" stroke="var(--of-steam)" strokeWidth="1" opacity="0.25">
        <animate attributeName="d" values="M46 -1 Q47 -6 48 -1;M46 -3 Q47 -8 48 -3;M46 -1 Q47 -6 48 -1" dur="2.5s" repeatCount="indefinite" />
      </path>
      {/* Nameplate */}
      <rect x="-55" y="6" width="28" height="10" rx="2" fill="var(--of-nameplate)" />
      <rect x="-53" y="8" width="24" height="6" rx="1" fill="var(--of-nameplate)" opacity="0.6" />
    </g>
  )
}

function WorkerDesk({ x, y }: { x: number; y: number }): React.JSX.Element {
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Desk */}
      <rect x="-50" y="0" width="100" height="40" rx="3" fill="var(--of-desk)" />
      <rect x="-52" y="-2" width="104" height="5" rx="2" fill="var(--of-desk-top)" />
      {/* Legs */}
      <rect x="-44" y="38" width="5" height="16" rx="1" fill="var(--of-desk-leg)" />
      <rect x="39" y="38" width="5" height="16" rx="1" fill="var(--of-desk-leg)" />
      {/* Laptop */}
      <rect x="-22" y="-22" width="44" height="20" rx="2" fill="var(--of-monitor)" />
      <rect x="-19" y="-19" width="38" height="15" rx="1.5" fill="var(--of-screen)" />
      {/* Screen lines */}
      <rect x="-15" y="-15" width="16" height="1.5" rx="0.75" fill="var(--of-screen-text)" opacity="0.5" />
      <rect x="-15" y="-11" width="24" height="1.5" rx="0.75" fill="var(--of-screen-text)" opacity="0.3" />
      {/* Laptop base */}
      <rect x="-25" y="-2" width="50" height="6" rx="1.5" fill="var(--of-keyboard)" />
      {/* Notebook */}
      <rect x="28" y="4" width="16" height="20" rx="1" fill="var(--of-notebook)" />
      <rect x="30" y="8" width="10" height="1" rx="0.5" fill="var(--of-notebook-line)" opacity="0.3" />
      <rect x="30" y="12" width="12" height="1" rx="0.5" fill="var(--of-notebook-line)" opacity="0.3" />
      <rect x="30" y="16" width="8" height="1" rx="0.5" fill="var(--of-notebook-line)" opacity="0.3" />
    </g>
  )
}

function Plant({ x, y, size = 1 }: { x: number; y: number; size?: number }): React.JSX.Element {
  return (
    <g transform={`translate(${x},${y}) scale(${size})`}>
      {/* Pot */}
      <rect x="-8" y="0" width="16" height="14" rx="2" fill="var(--of-pot)" />
      <rect x="-10" y="-2" width="20" height="4" rx="2" fill="var(--of-pot-rim)" />
      {/* Leaves */}
      <ellipse cx="-6" cy="-10" rx="8" ry="6" fill="var(--of-plant)" transform="rotate(-20 -6 -10)" />
      <ellipse cx="6" cy="-12" rx="7" ry="5" fill="var(--of-plant-light)" transform="rotate(15 6 -12)" />
      <ellipse cx="0" cy="-16" rx="6" ry="5" fill="var(--of-plant)" transform="rotate(-5 0 -16)" />
      <ellipse cx="-3" cy="-20" rx="5" ry="4" fill="var(--of-plant-light)" transform="rotate(-10 -3 -20)" />
    </g>
  )
}

function WaterCooler({ x, y }: { x: number; y: number }): React.JSX.Element {
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Body */}
      <rect x="-10" y="0" width="20" height="35" rx="3" fill="var(--of-cooler)" />
      {/* Bottle */}
      <rect x="-7" y="-20" width="14" height="22" rx="5" fill="var(--of-water)" opacity="0.5" />
      <rect x="-5" y="-24" width="10" height="6" rx="3" fill="var(--of-water)" opacity="0.4" />
      {/* Tap */}
      <rect x="6" y="10" width="6" height="3" rx="1" fill="var(--of-cooler-tap)" />
      {/* Legs */}
      <rect x="-8" y="35" width="4" height="8" rx="1" fill="var(--of-cooler)" />
      <rect x="4" y="35" width="4" height="8" rx="1" fill="var(--of-cooler)" />
    </g>
  )
}

function Whiteboard({ x, y }: { x: number; y: number }): React.JSX.Element {
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Frame */}
      <rect x="-50" y="-40" width="100" height="60" rx="3" fill="var(--of-wb-frame)" />
      {/* Board */}
      <rect x="-46" y="-36" width="92" height="52" rx="2" fill="var(--of-wb-surface)" />
      {/* Scribbles */}
      <path d="M-35 -25 Q-20 -30 -10 -22" stroke="var(--of-wb-ink)" strokeWidth="1.5" fill="none" opacity="0.5" />
      <path d="M-30 -15 L10 -15" stroke="var(--of-wb-ink2)" strokeWidth="1" fill="none" opacity="0.3" />
      <path d="M-30 -8 L-5 -8" stroke="var(--of-wb-ink)" strokeWidth="1" fill="none" opacity="0.4" />
      <rect x="15" y="-28" width="20" height="14" rx="1" stroke="var(--of-wb-ink2)" strokeWidth="1" fill="none" opacity="0.3" />
      <path d="M-25 2 Q-10 -5 5 2 Q15 7 30 0" stroke="var(--of-wb-ink)" strokeWidth="1.5" fill="none" opacity="0.4" />
      {/* Marker tray */}
      <rect x="-30" y="18" width="60" height="4" rx="1" fill="var(--of-wb-frame)" />
      <rect x="-20" y="16" width="3" height="6" rx="1" fill="#E84A4A" />
      <rect x="-14" y="16" width="3" height="6" rx="1" fill="#4A8CE8" />
      <rect x="-8" y="16" width="3" height="6" rx="1" fill="#4AE84A" />
    </g>
  )
}

/* ──────────────────────────────────────────────────────
   The office floor canvas
   ────────────────────────────────────────────────────── */

interface BubbleInfo {
  name: string
  x: number
  y: number
}

function OfficeFloor({
  profiles,
  activeProfile,
  onChatWith,
  onSelectProfile,
  providerLabel
}: {
  profiles: ProfileInfo[]
  activeProfile: string
  onChatWith: (name: string) => void
  onSelectProfile: (name: string) => void
  providerLabel: (p: string) => string
}): React.JSX.Element {
  const defaultProfile = profiles.find((p) => p.isDefault)
  const workers = profiles.filter((p) => !p.isDefault)

  // Layout calculations
  const cols = Math.min(workers.length || 1, 3)
  const rows = Math.ceil(workers.length / 3)
  const canvasW = Math.max(600, cols * 200 + 140)
  const workerAreaH = rows > 0 ? rows * 155 + 20 : 0
  const canvasH = 260 + workerAreaH

  // Bubble popup state
  const [bubble, setBubble] = useState<BubbleInfo | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Drag / pan state
  const isDragging = useRef(false)
  const hasDragged = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = wrapperRef.current
    if (!el) return
    if ((e.target as HTMLElement).closest('.office-bubble')) return
    isDragging.current = true
    hasDragged.current = false
    dragStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }
    el.style.cursor = 'grabbing'
    e.preventDefault()
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const el = wrapperRef.current
    if (!el) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true
    el.scrollLeft = dragStart.current.scrollLeft - dx
    el.scrollTop = dragStart.current.scrollTop - dy
  }, [])

  const onMouseUp = useCallback(() => {
    isDragging.current = false
    if (wrapperRef.current) wrapperRef.current.style.cursor = ''
  }, [])

  // Convert SVG coordinates to pixel position for the bubble
  const svgToPixel = useCallback((svgX: number, svgY: number): { x: number; y: number } => {
    const svg = svgRef.current
    const wrapper = wrapperRef.current
    if (!svg || !wrapper) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = svgX
    pt.y = svgY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const screenPt = pt.matrixTransform(ctm)
    const wrapperRect = wrapper.getBoundingClientRect()
    return {
      x: screenPt.x - wrapperRect.left + wrapper.scrollLeft,
      y: screenPt.y - wrapperRect.top + wrapper.scrollTop
    }
  }, [])

  const handleAgentClick = useCallback((name: string, svgX: number, svgY: number) => {
    if (hasDragged.current) return
    if (bubble?.name === name) {
      setBubble(null)
      return
    }
    const pos = svgToPixel(svgX, svgY)
    setBubble({ name, x: pos.x, y: pos.y })
  }, [bubble, svgToPixel])

  // Close bubble on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (!(e.target as HTMLElement).closest('.office-bubble, .office-agent-zone')) {
        setBubble(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const bubbleProfile = bubble ? profiles.find((p) => p.name === bubble.name) : null

  return (
    <div
      className="office-canvas-wrapper"
      ref={wrapperRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        className="office-canvas"
        preserveAspectRatio="xMidYMin meet"
      >
        <defs>
          <pattern id="floor-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="var(--of-floor)" />
            <rect x="0" y="0" width="40" height="40" fill="none" stroke="var(--of-floor-line)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={canvasW} height={canvasH} fill="url(#floor-grid)" rx="8" />

        {/* Whiteboard — tight to top */}
        <Whiteboard x={canvasW / 2} y={30} />

        {/* Manager section */}
        {defaultProfile && (
          <g>
            {/* Name tag above the monitor */}
            <text
              x={canvasW / 2} y={82} textAnchor="middle" fill="var(--of-role-text)"
              fontSize="8" fontWeight="600" fontFamily="var(--font-sans)" letterSpacing="0.08em"
              style={{ textTransform: 'uppercase' }}
            >
              MANAGER
            </text>
            <g transform={`translate(${canvasW / 2}, 94)`}>
              <rect x="-38" y="-8" width="76" height="17" rx="8.5" fill="var(--of-tag-bg)" />
              {activeProfile === defaultProfile.name && (
                <rect x="-38" y="-8" width="76" height="17" rx="8.5" fill="var(--accent)" opacity="0.2" />
              )}
              <text x="0" y="3.5" textAnchor="middle" fill="var(--of-tag-text)" fontSize="10" fontWeight="600" fontFamily="var(--font-sans)">
                {defaultProfile.name}
              </text>
            </g>

            <ellipse cx={canvasW / 2} cy={172} rx="100" ry="48" fill="var(--of-rug)" opacity="0.25" />
            <ManagerDesk x={canvasW / 2} y={145} />
            {/* Chair shadow, then robot in front of desk */}
            <ellipse cx={canvasW / 2} cy={252} rx="16" ry="7" fill="var(--of-chair)" opacity="0.5" />
            <Robot x={canvasW / 2} y={198} palette={getPalette(defaultProfile.name)} scale={1.05} isActive={activeProfile === defaultProfile.name} />

            <g
              className="office-agent-zone"
              onClick={() => handleAgentClick(defaultProfile.name, canvasW / 2, 78)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={canvasW / 2 - 80} y={72} width="160" height="190" rx="6"
                fill="transparent"
                className={`office-zone-hitbox ${activeProfile === defaultProfile.name ? 'office-zone-active' : ''}`}
              />
            </g>
          </g>
        )}

        {/* Decorations */}
        <Plant x={50} y={135} size={0.9} />
        <Plant x={canvasW - 50} y={150} size={0.8} />
        {workers.length > 0 && <WaterCooler x={canvasW - 55} y={285} />}

        {/* Worker desks */}
        {workers.map((w, i) => {
          const col = i % 3
          const row = Math.floor(i / 3)
          const startX = (canvasW - cols * 190) / 2 + 95
          const wx = startX + col * 190
          const wy = 310 + row * 155

          return (
            <g key={w.name}>
              {/* Name tag above the laptop */}
              <g transform={`translate(${wx}, ${wy - 36})`}>
                <rect x="-32" y="-7" width="64" height="15" rx="7.5" fill="var(--of-tag-bg)" />
                {activeProfile === w.name && (
                  <rect x="-32" y="-7" width="64" height="15" rx="7.5" fill="var(--accent)" opacity="0.2" />
                )}
                <text x="0" y="3" textAnchor="middle" fill="var(--of-tag-text)" fontSize="9" fontWeight="600" fontFamily="var(--font-sans)">
                  {w.name}
                </text>
              </g>

              <WorkerDesk x={wx} y={wy} />
              {/* Chair shadow, then robot in front */}
              <ellipse cx={wx} cy={wy + 95} rx="13" ry="5.5" fill="var(--of-chair)" opacity="0.4" />
              <Robot x={wx} y={wy + 48} palette={getPalette(w.name)} scale={0.85} isActive={activeProfile === w.name} />

              <g
                className="office-agent-zone"
                onClick={() => handleAgentClick(w.name, wx, wy - 44)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={wx - 58} y={wy - 44} width="116" height="150" rx="6"
                  fill="transparent"
                  className={`office-zone-hitbox ${activeProfile === w.name ? 'office-zone-active' : ''}`}
                />
              </g>
            </g>
          )
        })}

        {workers.length > 3 && <Plant x={65} y={440} size={0.7} />}
      </svg>

      {/* Bubble popup near the clicked agent */}
      {bubble && bubbleProfile && (
        <div
          className="office-bubble"
          style={{ left: bubble.x - 100, top: bubble.y - 8, transform: 'translateY(-100%)' }}
        >
          <div className="office-bubble-card">
            <div className="office-bubble-name">
              {bubbleProfile.isDefault && <span className="office-bubble-role">Manager</span>}
              {bubbleProfile.name}
            </div>
            <div className="office-bubble-model">
              {bubbleProfile.model ? bubbleProfile.model.split('/').pop() : 'No model set'}
            </div>
            <div className="office-bubble-meta">
              <span>{providerLabel(bubbleProfile.provider)}</span>
              <span className="agents-card-dot" />
              <span>{bubbleProfile.skillCount} skills</span>
              {bubbleProfile.gatewayRunning && (
                <>
                  <span className="agents-card-dot" />
                  <span className="agents-card-gateway-on">Gateway on</span>
                </>
              )}
            </div>
            <div className="office-bubble-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setBubble(null); onChatWith(bubbleProfile.name) }}
              >
                <ChatBubble size={14} />
                Chat
              </button>
              {activeProfile !== bubbleProfile.name && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setBubble(null); onSelectProfile(bubbleProfile.name) }}
                >
                  Set Active
                </button>
              )}
              {activeProfile === bubbleProfile.name && (
                <span className="agents-card-active-badge">Active</span>
              )}
            </div>
          </div>
          <div className="office-bubble-arrow" />
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────
   Main Agents component
   ────────────────────────────────────────────────────── */

function AgentAvatar({ name }: { name: string }): React.JSX.Element {
  if (name === 'default') {
    return (
      <div className="agents-card-avatar agents-card-avatar-icon">
        <img src={icon} width={22} height={22} alt="" />
      </div>
    )
  }
  return <div className="agents-card-avatar">{name.charAt(0).toUpperCase()}</div>
}

function Agents({ activeProfile, onSelectProfile, onChatWith }: AgentsProps): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('interactive')
  const [profiles, setProfiles] = useState<ProfileInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [cloneConfig, setCloneConfig] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function loadProfiles(): Promise<void> {
    const list = await window.hermesAPI.listProfiles()
    setProfiles(list)
    setLoading(false)
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  async function handleCreate(): Promise<void> {
    const name = newName.trim().toLowerCase()
    if (!name) return
    setCreating(true)
    setError('')
    const result = await window.hermesAPI.createProfile(name, cloneConfig)
    setCreating(false)
    if (result.success) {
      setShowCreate(false)
      setNewName('')
      loadProfiles()
    } else {
      setError(result.error || 'Failed to create profile')
    }
  }

  async function handleDelete(name: string): Promise<void> {
    const result = await window.hermesAPI.deleteProfile(name)
    if (result.success) {
      if (activeProfile === name) onSelectProfile('default')
      loadProfiles()
    }
    setConfirmDelete(null)
  }

  async function handleSelect(name: string): Promise<void> {
    await window.hermesAPI.setActiveProfile(name)
    onSelectProfile(name)
    loadProfiles()
  }

  function providerLabel(provider: string): string {
    if (!provider || provider === 'auto') return 'Auto'
    if (provider === 'custom') return 'Local'
    return provider.charAt(0).toUpperCase() + provider.slice(1)
  }

  if (loading) {
    return (
      <div className="agents-container">
        <div className="agents-loading"><div className="loading-spinner" /></div>
      </div>
    )
  }

  return (
    <div className="agents-container">
      <div className="agents-header">
        <div>
          <h2 className="agents-title">Agents</h2>
          <p className="agents-subtitle">
            Each agent is an isolated Hermes instance with its own config, memory, and skills
          </p>
        </div>
      </div>

      <div className="agents-tabs">
        <button className={`agents-tab ${tab === 'interactive' ? 'active' : ''}`} onClick={() => setTab('interactive')}>
          Office
        </button>
        <button className={`agents-tab ${tab === 'manage' ? 'active' : ''}`} onClick={() => setTab('manage')}>
          Manage
        </button>
      </div>

      {tab === 'interactive' && (
        <OfficeFloor
          profiles={profiles}
          activeProfile={activeProfile}
          onChatWith={onChatWith}
          onSelectProfile={handleSelect}
          providerLabel={providerLabel}
        />
      )}

      {tab === 'manage' && (
        <>
          <div className="agents-manage-toolbar">
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              New Agent
            </button>
          </div>

          {showCreate && (
            <div className="agents-create">
              <input
                className="input"
                placeholder="Agent name (e.g. coder)"
                value={newName}
                onChange={(e) => {
                  const v = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
                  setNewName(v)
                  setError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <label className="agents-create-clone">
                <input type="checkbox" checked={cloneConfig} onChange={(e) => setCloneConfig(e.target.checked)} />
                <span>Clone config &amp; API keys from default</span>
              </label>
              {error && <div className="agents-create-error">{error}</div>}
              <div className="agents-create-actions">
                <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowCreate(false); setError('') }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="agents-grid">
            {profiles.map((p) => (
              <button
                key={p.name}
                className={`agents-card ${activeProfile === p.name ? 'active' : ''}`}
                onClick={() => handleSelect(p.name)}
              >
                <div className="agents-card-header">
                  <AgentAvatar name={p.name} />
                  <div className="agents-card-info">
                    <div className="agents-card-name">{p.name}</div>
                    <div className="agents-card-provider">{providerLabel(p.provider)}</div>
                  </div>
                  {activeProfile === p.name && <span className="agents-card-active-badge">Active</span>}
                </div>
                <div className="agents-card-model">{p.model ? p.model.split('/').pop() : 'No model set'}</div>
                <div className="agents-card-stats">
                  <span>{p.skillCount} skills</span>
                  <span className="agents-card-dot" />
                  {p.gatewayRunning ? <span className="agents-card-gateway-on">Gateway running</span> : <span>Gateway off</span>}
                </div>
                {!p.isDefault && (
                  confirmDelete === p.name ? (
                    <div className="agents-card-confirm-delete" onClick={(e) => e.stopPropagation()}>
                      <span>Delete?</span>
                      <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(p.name) }}>Yes</button>
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(null) }}>No</button>
                    </div>
                  ) : (
                    <button className="agents-card-delete" onClick={(e) => { e.stopPropagation(); setConfirmDelete(p.name) }} title="Delete agent">
                      <Trash size={14} />
                    </button>
                  )
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Agents
