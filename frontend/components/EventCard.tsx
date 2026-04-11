interface EventCardProps {
  title: string
  date_et: string
  end_date_et: string
  location: string
  organization?: string
  benefits?: string[]
  image_url?: string
  url?: string
  variant: 'primary' | 'similar'
}

export default function EventCard({ title, date_et, end_date_et, location, organization, benefits, image_url, url, variant }: EventCardProps) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      <div style={{
        background: variant === 'primary' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)',
        border: variant === 'primary' ? '2px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.2)',
        borderRadius: '8px',
        padding: variant === 'primary' ? '14px 16px' : '10px 14px',
        marginTop: '10px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        cursor: url ? 'pointer' : 'default',
        transition: 'background 0.2s ease'
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
      onMouseLeave={e => e.currentTarget.style.background = variant === 'primary' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)'}
      >
        {image_url && variant === 'primary' && (
          <img src={image_url} alt={title} style={{
            width: '64px', height: '64px', objectFit: 'cover',
            borderRadius: '4px', imageRendering: 'auto', flexShrink: 0
          }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
            fontSize: variant === 'primary' ? '9px' : '8px',
            color: '#ffffff', marginBottom: '6px', lineHeight: 1.6
          }}>{title}</div>
          <div style={{
            fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
            fontSize: '7px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8
          }}>
            📅 {date_et} → {end_date_et}
          </div>
          <div style={{
            fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
            fontSize: '7px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8
          }}>
            📍 {location}
          </div>
          {organization && variant === 'primary' && (
            <div style={{
              fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
              fontSize: '7px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8
            }}>
              🏢 {organization}
            </div>
          )}
          {benefits && benefits.length > 0 && (
            <div style={{
              fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
              fontSize: '7px', color: '#FFD700', lineHeight: 1.8
            }}>
              🎁 {benefits.join(', ')}
            </div>
          )}
        </div>
      </div>
    </a>
  )
}
