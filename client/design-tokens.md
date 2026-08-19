# Dashboard Design Tokens (v2 — Light & Vibrant)

## Colors
- Background base: #F8F9FC
- Background elevated (cards): #FFFFFF
- Background card hover: #FDFDFF
- Card border: rgba(17, 24, 39, 0.06)
- Primary accent (actions/highlights): #7C5CFF
- Secondary accent (growth/success): #16D9A0
- Tertiary accent (energy/highlight — use sparingly for badges/achievements): #FF7A59
- Highlight accent (bids/opportunities): #FFC85C
- Warning: #FFB020
- Error: #FF5C5C
- Text primary: #14161F
- Text secondary: #6B7280
- Text muted: #9CA3AF
- Chart line 1 (earnings): #7C5CFF
- Chart line 2 (projects): #16D9A0
- Chart gradient fill opacity: 0.18 → 0
- Card accent backgrounds (subtle tint per stat type, use @6% opacity of accent color as card background wash — e.g. earnings card = primary accent tint, projects card = secondary accent tint, bids card = highlight accent tint)

## Typography
- Font: "Inter", -apple-system, "SF Pro Display", sans-serif
- H1: 28px / 700 / -0.02em
- H2: 20px / 600
- H3: 15px / 600
- Body: 14px / 400
- Caption: 12px / 400 / text-secondary
- Stat number: 32px / 700 / -0.02em
- Stat label: 13px / 500 / text-secondary / uppercase / 0.04em

## Spacing Scale
- Base unit: 4px | Scale: 4,8,12,16,24,32,48,64px
- Page padding: 32px desktop / 16px mobile
- Card internal padding: 24px
- Gap between cards: 16px
- Gap between sections: 32px

## Card Style Rules
- Border radius: 16px
- Border: 1px solid card border color
- Shadow resting: 0 1px 3px rgba(17,24,39,0.06)
- Shadow hover: 0 12px 28px rgba(124,92,255,0.15)
- Hover lift: translateY(-3px)
- Each stat card gets a subtle colored top border (4px) matching its accent tint for quick visual scanning
- Glassmorphism (hero/header only): blur 20px, bg rgba(255,255,255,0.6), border rgba(255,255,255,0.4), sits on a soft gradient background (primary accent → secondary accent, very low opacity, diagonal)

## Motion
- Standard transition: 200ms cubic-bezier(0.4,0,0.2,1)
- Card hover: 250ms ease-out
- Number count-up: 1200ms ease-out
- Chart entrance: 800ms ease-out, staggered 100ms per point
- Timeline entrance: fade + slideY(8px), 400ms, staggered 60ms per item
- Achievement/milestone cards get a subtle pulse or shimmer animation on load

## Icons
- Style: outline/stroke, 1.5px stroke weight
- Size: 20px in cards, 16px in activity feed
- Icon container: 40px circle, bg = accent @12% opacity, icon = accent @100%

## Progress Rings
- Stroke width: 6px
- Track: text-muted @12% opacity
- Progress: primary accent (success color if 100%, tertiary accent glow if a milestone is hit)
- Size: 64px diameter in stat cards
