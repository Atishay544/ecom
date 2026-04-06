import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'My Store'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    <div style={{
      background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color: 'white', fontSize: 80, fontWeight: 'bold', letterSpacing: '-2px' }}>
        STORE
      </div>
      <div style={{ color: '#999', fontSize: 28, marginTop: 20 }}>
        Shop the best products at the best prices
      </div>
    </div>
  )
}
