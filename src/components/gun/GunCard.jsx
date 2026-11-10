import FavoriteButton from '../common/FavoriteButton'
import { formatPrice, truncate } from '../../utils/helpers'
import { Share2 } from 'lucide-react'

/**
 * Product card used in the catalog grid.
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — product data
 * @param {Function} props.onSelect  — called with the gun when clicked
 * @param {Function} [props.onEdit]  — called when Edit is clicked (admin)
 * @param {Function} [props.onDelete]— called when Delete is clicked (admin)
 */
export default function GunCard({ gun, onSelect, onEdit, onDelete }) {
  const imgSrc = gun.image_url || gun.image || '/guns/pistol.svg'
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0
  const handleShare = async (e) => {
  e.stopPropagation()

  if (!gun.id) {
    alert('Produk belum memiliki ID.')
    return
  }

  const shareUrl = new URL(window.location.href)
  shareUrl.search = ''
  shareUrl.searchParams.set('product', gun.id)

  const shareData = {
    title: gun.name,
    text: `Lihat katalog ${gun.name}`,
    url: shareUrl.toString(),
  }

  try {
    if (navigator.share) {
      await navigator.share(shareData)
    } else {
      await navigator.clipboard.writeText(shareData.url)
      alert('Link berhasil disalin!')
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      try {
        await navigator.clipboard.writeText(shareData.url)
        alert('Link berhasil disalin!')
      } catch {
        alert('Gagal membagikan link.')
      }
    }
  }
}

  return (
    <li className="card">
      <button
        type="button"
        className="card-btn"
        onClick={() => onSelect(gun)}
        aria-label={`View ${gun.name}`}
      >
        <img
      className="card-img"
      src={imgSrc}
      alt={gun.name}
      width="240"
      height="180"
      loading="lazy"
      decoding="async"
      onError={(e) => {
    e.currentTarget.onerror = null
    e.currentTarget.src = '/guns/pistol.svg'
  }}
/>

        <span className="name display">{gun.name}</span>

        <span className="type">
          {category}
          {caliber ? ` · ${caliber}` : ''}
        </span>

        {gun.description && (
          <span className="card-desc">{truncate(gun.description, 72)}</span>
        )}

        <span className="price">{formatPrice(price)}</span>
      </button>

      {/* Floating actions row */}
      <div className="card-actions">
  <FavoriteButton gunId={gun.id || gun.name} />

  <button
    type="button"
    className="card-act-btn"
    onClick={handleShare}
    title="Share Product"
    aria-label={`Share ${gun.name}`}
  >
    <Share2 size={16} />
  </button>

        {onEdit && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => { e.stopPropagation(); onEdit(gun) }}
            aria-label={`Edit ${gun.name}`}
            title="Edit"
          >
            ✏️
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            className="card-act-btn card-act-btn--danger"
            onClick={(e) => { e.stopPropagation(); onDelete(gun) }}
            aria-label={`Delete ${gun.name}`}
            title="Delete"
          >
            🗑️
          </button>
        )}
      </div>
    </li>
  )
}
