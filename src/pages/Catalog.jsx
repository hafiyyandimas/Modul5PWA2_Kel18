
import { useState, useMemo, useEffect } from 'react'
import {
  RefreshCw,
  Plus,
  Loader,
  AlertCircle,
  PackageOpen,
} from 'lucide-react'

import { useGuns } from '../hooks/useGuns'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'
import GunDetail from '../components/gun/GunDetail'
import AdvancedFilter from '../components/common/AdvancedFilter'
import ConfirmModal from '../components/modals/ConfirmModal'
import gunService from '../services/gunService'

import {
  matchesSearch,
  matchesCategory,
  sortItems,
  extractCategories,
} from '../utils/helpers'

export default function Catalog({ onNavigate }) {
  // ---- Pagination ----
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // ---- API data + Query Cache ----
  const {
    guns: apiGuns,
    loading,
    error,
    refetch,
    pagination,
    cacheHit,
  } = useGuns({
    page: currentPage,
    limit: itemsPerPage,
  })

  useEffect(() => {
    console.log('Query Cache Hit:', cacheHit)
  }, [cacheHit])

  const [useLocal, setUseLocal] = useState(false)

  // ---- Decide data source ----
  const isLocalData = useLocal || (error && apiGuns.length === 0)

  const rawGuns = useMemo(() => {
    if (isLocalData) {
      return GUNS_LOCAL.map((g, i) => ({
        ...g,
        id: g.id || `local-${i}`,
      }))
    }

    return apiGuns
  }, [apiGuns, isLocalData])

  // ---- Search, category, and sorting ----
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')

  const categories = useMemo(
    () => extractCategories(rawGuns),
    [rawGuns]
  )

  const filteredGuns = useMemo(() => {
    const result = rawGuns.filter(
      (g) =>
        matchesSearch(g, search) &&
        matchesCategory(g, activeCategory)
    )

    return sortItems(result, sortKey, sortOrder)
  }, [
    rawGuns,
    search,
    activeCategory,
    sortKey,
    sortOrder,
  ])

  // ---- Calculate total pages ----
  const totalPages = Math.max(
    1,
    isLocalData
      ? Math.ceil(filteredGuns.length / itemsPerPage)
      : pagination?.totalPages || 1
  )

  // ---- Display products on current page ----
  const displayedGuns = useMemo(() => {
    if (isLocalData) {
      const start = (currentPage - 1) * itemsPerPage

      return filteredGuns.slice(
        start,
        start + itemsPerPage
      )
    }

    return filteredGuns
  }, [
    filteredGuns,
    currentPage,
    isLocalData,
  ])

  // ---- Reset page when filters change ----
  const handleSearch = (value) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const handleCategory = (value) => {
    setActiveCategory(value)
    setCurrentPage(1)
  }

  const handleSort = ({ key, order }) => {
    setSortKey(key)
    setSortOrder(order)
    setCurrentPage(1)
  }

  // ---- Detail view ----
  const [selectedGun, setSelectedGun] = useState(null)

  // ---- Delete ----
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      setDeleting(true)
      setDeleteError('')

      await gunService.deleteGun(deleteTarget.id)

      setDeleteTarget(null)
      refetch()
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  // ---- Detail page ----
  if (selectedGun) {
    return (
      <GunDetail
        gun={selectedGun}
        onBack={() => setSelectedGun(null)}
        onEdit={(g) => onNavigate && onNavigate('Edit', g)}
        onDelete={(g) => {
          setSelectedGun(null)
          setDeleteTarget(g)
        }}
      />
    )
  }

  // ---- Main catalog page ----
  return (
    <>
      <section className="masthead">
        <h1 className="display">
          Hardware, by the spec sheet.
        </h1>

        <p className="lede">
          A small armory of pistols, rifles, and shotguns.
          Every piece listed with its type, caliber, and price
          — nothing else.
        </p>
      </section>

      <section>
        <div className="list-head">
          <h2>Current stock</h2>

          <div className="list-head-right">
            <span className="count">
              {filteredGuns.length} piece
              {filteredGuns.length !== 1 ? 's' : ''}
            </span>

            {onNavigate && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => onNavigate('Create')}
              >
                <Plus size={16} /> Add
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <AdvancedFilter
          search={search}
          onSearch={handleSearch}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={handleCategory}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSort}
        />

        {/* Loading state */}
        {loading && (
          <div className="state-box">
            <Loader size={28} className="spin" />
            <p>Loading products…</p>
          </div>
        )}

        {/* API error state */}
        {!loading && error && !useLocal && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{error}</p>

            <div className="state-box__actions">
              <button
                type="button"
                className="btn btn--outline"
                onClick={refetch}
              >
                <RefreshCw size={16} /> Retry
              </button>

              <button
                type="button"
                className="btn btn--outline"
                onClick={() => {
                  setUseLocal(true)
                  setCurrentPage(1)
                }}
              >
                View Local Catalog
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredGuns.length === 0 && !error && (
          <div className="state-box">
            <PackageOpen size={28} />
            <p>No products match your search.</p>
          </div>
        )}

        {/* Product grid */}
        {!loading && displayedGuns.length > 0 && (
          <ul className="stock">
            {displayedGuns.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                onSelect={setSelectedGun}
                onEdit={
                  onNavigate
                    ? (g) => onNavigate('Edit', g)
                    : undefined
                }
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
        )}

        {/* Pagination */}
        {!loading && filteredGuns.length > 0 && (
          <div className="pagination">
            <button
              type="button"
              className="btn btn--outline"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.max(1, page - 1)
                )
              }
              disabled={currentPage === 1}
            >
              Previous
            </button>

            <span className="pagination__info">
              Halaman {currentPage} dari {totalPages}
            </span>

            <button
              type="button"
              className="btn btn--outline"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1)
                )
              }
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        )}

        {/* Local catalog notice */}
        {useLocal && (
          <p className="local-notice">
            Showing local catalog (server unavailable).{' '}

            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setUseLocal(false)
                setCurrentPage(1)
                refetch()
              }}
            >
              Retry server
            </button>
          </p>
        )}
      </section>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError('')
        }}
      />

      {deleteError && (
        <div className="toast toast--error">
          {deleteError}
        </div>
      )}
    </>
  )
}
