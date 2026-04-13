import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'LayerFactory — Premium Marble & Spiritual Products'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    <div style={{
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1c1c1c 50%, #0d0d0d 100%)',
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '60px',
      position: 'relative',
    }}>
      {/* Gold accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '6px',
        background: 'linear-gradient(90deg, #b8860b, #ffd700, #b8860b)',
      }} />
      {/* Brand name */}
      <div style={{
        color: '#ffd700',
        fontSize: 72,
        fontWeight: 900,
        letterSpacing: '-2px',
        marginBottom: '16px',
        textShadow: '0 2px 20px rgba(255,215,0,0.3)',
      }}>
        LayerFactory
      </div>
      {/* Tagline */}
      <div style={{
        color: '#cccccc',
        fontSize: 28,
        letterSpacing: '2px',
        textTransform: 'uppercase',
        marginBottom: '8px',
      }}>
        Premium Marble &amp; Spiritual Products
      </div>
      {/* Sub-line */}
      <div style={{
        color: '#888888',
        fontSize: 20,
        marginTop: '12px',
      }}>
        Divine Collection · Free Shipping above ₹499
      </div>
      {/* Bottom accent bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '6px',
        background: 'linear-gradient(90deg, #b8860b, #ffd700, #b8860b)',
      }} />
    </div>,
    size
  )
}
