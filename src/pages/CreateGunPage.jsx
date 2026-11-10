
import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Loader,
  Save,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

import gunService from '../services/gunService'
import uploadService from '../services/uploadService'
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  hasDraft,
  getDraftTimestamp,
  formatDraftTime,
} from '../utils/draftStorage'
import ConfirmModal from '../components/modals/ConfirmModal'

// Hanya izinkan URL permanen atau path lokal.
// Blob URL dan data URL tidak boleh disimpan sebagai URL produk.
const isSafeImageUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) return false

  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return false
  }

  return (
    url.startsWith('/') ||
    url.startsWith('https://') ||
    url.startsWith('http://')
  )
}

const DEFAULT_IMAGE = '/guns/pistol.svg'

export default function CreateGunPage({ onBack, onSuccess }) {
  const [currentStep, setCurrentStep] = useState('upload')

  const [formData, setFormData] = useState({
    name: '',
    type: 'Pistol',
    caliber: '9mm',
    category: 'makanan',
    difficulty: 'mudah',
    price: 599,
    description: '',
    servings: 1,
    is_featured: false,
  })

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState('')

  const [specs, setSpecs] = useState([
    { name: 'Frame', quantity: 'Polymer' },
    { name: 'Action', quantity: 'Standard' },
    { name: 'Capacity', quantity: 'Standard' },
  ])

  const [steps, setSteps] = useState([
    'Refer to the official product documentation.',
    'Follow the applicable manufacturer safety guidance.',
  ])

  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [showDraftModal, setShowDraftModal] = useState(
    () => hasDraft('create')
  )
  const [draftTimestamp, setDraftTimestamp] = useState(
    () => getDraftTimestamp('create')
  )

  // Bersihkan Blob URL ketika preview diganti atau halaman ditutup.
  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  // Simpan hanya URL gambar yang aman ke draft.
  const handleSaveDraft = useCallback((notify = true) => {
    const safeImageUrl = isSafeImageUrl(uploadedImageUrl)
      ? uploadedImageUrl
      : ''

    const draftData = {
      formData,
      specs,
      steps,
      uploadedImageUrl: safeImageUrl,
    }

    const saved = saveDraft(draftData, 'create')

    if (saved) {
      const ts = getDraftTimestamp('create')
      setDraftTimestamp(ts)

      if (notify) {
        setSuccessMsg(`Draft saved (${formatDraftTime(ts)})`)
        setTimeout(() => setSuccessMsg(''), 3000)
      }
    }
  }, [formData, specs, steps, uploadedImageUrl])

  // Auto-save setiap 30 detik saat mengisi form.
  useEffect(() => {
    if (currentStep !== 'form') return

    const interval = setInterval(() => {
      handleSaveDraft(false)
    }, 30000)

    return () => clearInterval(interval)
  }, [handleSaveDraft, currentStep])

  // Memulihkan draft dan memeriksa URL gambar.
  const handleLoadDraft = () => {
    const draft = loadDraft('create')

    if (draft) {
      if (draft.formData) setFormData(draft.formData)
      if (draft.specs) setSpecs(draft.specs)
      if (draft.steps) setSteps(draft.steps)

      const safeUrl = isSafeImageUrl(draft.uploadedImageUrl)
        ? draft.uploadedImageUrl
        : ''

      setUploadedImageUrl(safeUrl)
      setImagePreview(safeUrl || null)
      setCurrentStep(safeUrl ? 'form' : 'upload')

      setShowDraftModal(false)
      setSuccessMsg('Draft successfully loaded.')
      setTimeout(() => setSuccessMsg(''), 4000)
    } else {
      setShowDraftModal(false)
    }
  }

  const handleDiscardDraft = () => {
    deleteDraft('create')
    setShowDraftModal(false)
    setDraftTimestamp(null)
  }

  // Pilih file gambar.
  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit.')
      e.target.value = ''
      return
    }

    const allowed = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ]

    if (!allowed.includes(file.type)) {
      setError('Allowed formats: .jpg, .jpeg, .png, .webp')
      e.target.value = ''
      return
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setUploadedImageUrl('')
    setError('')
    setSuccessMsg('')
  }

  // Pilih gambar preset lokal.
  const handleSelectPreset = (url) => {
    if (!isSafeImageUrl(url)) return

    setImageFile(null)
    setImagePreview(url)
    setUploadedImageUrl(url)
    setCurrentStep('form')
    setError('')
    setSuccessMsg('')
  }

  // Upload gambar ke server.
  const handleUploadImage = async () => {
    if (!imageFile) {
      if (isSafeImageUrl(uploadedImageUrl)) {
        setCurrentStep('form')
        return
      }

      setError('Please select an image file or choose a preset.')
      return
    }

    try {
      setUploading(true)
      setError('')
      setSuccessMsg('')

      const result = await uploadService.uploadImage(imageFile)

      if (!result.success || !isSafeImageUrl(result.data?.url)) {
        throw new Error(
          result.message || 'Image upload failed or returned an invalid URL.'
        )
      }

      // Simpan URL permanen dari server, bukan Blob preview.
      setUploadedImageUrl(result.data.url)
      setImagePreview(result.data.url)
      setImageFile(null)
      setCurrentStep('form')
      setSuccessMsg('Image uploaded successfully.')
    } catch (err) {
      console.warn('Image upload failed:', err)

      // Jangan simpan Blob URL. Gunakan gambar default.
      setUploadedImageUrl(DEFAULT_IMAGE)
      setImagePreview(DEFAULT_IMAGE)
      setImageFile(null)
      setCurrentStep('form')
      setError('Image upload failed. Default image will be used.')
    } finally {
      setUploading(false)
    }
  }

  // Lanjut tanpa upload.
  const handleContinueWithoutUploading = () => {
    // Jika memilih preset, gunakan URL preset.
    // Jika memilih file lokal yang belum diupload, gunakan gambar default.
    const safeUrl = imageFile
      ? DEFAULT_IMAGE
      : isSafeImageUrl(uploadedImageUrl)
        ? uploadedImageUrl
        : DEFAULT_IMAGE

    setUploadedImageUrl(safeUrl)
    setImagePreview(safeUrl)
    setImageFile(null)
    setCurrentStep('form')
    setError('')
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSpecChange = (index, field, value) => {
    setSpecs((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const addSpec = () => {
    setSpecs((prev) => [...prev, { name: '', quantity: '' }])
  }

  const removeSpec = (index) => {
    if (specs.length <= 1) return
    setSpecs((prev) => prev.filter((_, i) => i !== index))
  }

  const handleStepChange = (index, value) => {
    setSteps((prev) => {
      const copy = [...prev]
      copy[index] = value
      return copy
    })
  }

  const addStep = () => {
    setSteps((prev) => [...prev, ''])
  }

  const removeStep = (index) => {
    if (steps.length <= 1) return
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  // Simpan produk.
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!formData.name.trim() || formData.name.trim().length < 3) {
      setError('Product name must be at least 3 characters.')
      return
    }

    const cleanSpecs = specs
      .filter((s) => s.name.trim())
      .map((s) => ({
        name: s.name.trim(),
        quantity: s.quantity.trim() || 'Standard',
      }))

    if (cleanSpecs.length === 0) {
      setError('Please provide at least one specification.')
      return
    }

    const cleanSteps = steps
      .filter((s) => s.trim())
      .map((s) => s.trim())

    if (cleanSteps.length === 0) {
      setError('Please provide at least one documentation step.')
      return
    }

    // Validasi terakhir agar Blob URL tidak terkirim ke API.
    const safeImageUrl = isSafeImageUrl(uploadedImageUrl)
      ? uploadedImageUrl
      : DEFAULT_IMAGE

    const payload = {
      name: formData.name.trim(),
      category: formData.category || 'makanan',
      description:
        formData.description.trim() ||
        `${formData.type} caliber ${formData.caliber}.`,
      image_url: safeImageUrl,
      prep_time: 15,
      cook_time: Number(formData.price) || 500,
      servings: Number(formData.servings) || 1,
      difficulty: formData.difficulty || 'mudah',
      is_featured: Boolean(formData.is_featured),
      ingredients: cleanSpecs,
      steps: cleanSteps,
    }

    try {
      setCreating(true)

      const response = await gunService.createGun(payload)

      if (response.success || response.data) {
        deleteDraft('create')

        if (onSuccess) {
          onSuccess(response.data)
        } else if (onBack) {
          onBack()
        }
      } else {
        throw new Error(response.message || 'Failed to create product.')
      }
    } catch (err) {
      setError(
        err.message || 'Error occurred while saving product to server.'
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="form-page">
      {/* Header */}
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Catalog
        </button>

        <div className="form-head-actions">
          {currentStep === 'form' && (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => handleSaveDraft(true)}
              title="Save draft"
            >
              <Save size={14} /> Save Draft
            </button>
          )}
        </div>
      </div>

      <div className="form-title-group">
        <h1 className="display">Register New Hardware</h1>
        <p className="lede">
          Add a new item to the catalog. Product data will be saved
          to the application backend.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="toast toast--error">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {successMsg && (
        <div className="toast toast--success">
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      {/* Step indicators */}
      <div className="form-steps-nav">
        <div
          className={`step-badge ${
            currentStep === 'upload'
              ? 'step-badge--active'
              : 'step-badge--done'
          }`}
        >
          1. Imagery
        </div>

        <div className="step-badge-connector" />

        <div
          className={`step-badge ${
            currentStep === 'form' ? 'step-badge--active' : ''
          }`}
        >
          2. Specifications &amp; Details
        </div>
      </div>

      {/* STEP 1: Image */}
      {currentStep === 'upload' && (
        <div className="card-box">
          <h2 className="card-box-title">Product Imagery</h2>

          <p className="card-box-desc">
            Select an image file up to 5MB, or choose a local preset.
          </p>

          {!imagePreview ? (
            <div className="upload-dropzone">
              <input
                id="gun-image-input"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleImageChange}
                className="hidden-file-input"
              />

              <label
                htmlFor="gun-image-input"
                className="upload-label"
              >
                <Upload size={36} className="upload-icon" />
                <span className="upload-main-text">
                  Click to choose an image file
                </span>
                <span className="upload-sub-text">
                  JPG, PNG, or WebP up to 5MB
                </span>
              </label>

              <div className="preset-selector">
                <span className="preset-title">
                  Or use a stock preset:
                </span>

                <div className="preset-pills">
                  <button
                    type="button"
                    className="pill"
                    onClick={() => handleSelectPreset('/guns/pistol.svg')}
                  >
                    Preset 1
                  </button>

                  <button
                    type="button"
                    className="pill"
                    onClick={() => handleSelectPreset('/guns/rifle.svg')}
                  >
                    Preset 2
                  </button>

                  <button
                    type="button"
                    className="pill"
                    onClick={() => handleSelectPreset('/guns/shotgun.svg')}
                  >
                    Preset 3
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="preview-container">
              <div className="preview-image-wrap">
                <img
                  src={imagePreview}
                  alt="Product preview"
                  className="preview-img"
                />

                <button
                  type="button"
                  className="preview-remove-btn"
                  onClick={() => {
                    setImageFile(null)
                    setImagePreview(null)
                    setUploadedImageUrl('')
                    setError('')
                  }}
                  title="Remove image"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="preview-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleUploadImage}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader size={18} className="spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Confirm Image &amp; Continue
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={handleContinueWithoutUploading}
                  disabled={uploading}
                >
                  Continue without uploading
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Form */}
      {currentStep === 'form' && (
        <form onSubmit={handleSubmit} className="entry-form">
          <div className="selected-thumb-bar">
            <img
              src={uploadedImageUrl || DEFAULT_IMAGE}
              alt="Selected"
              className="thumb-small"
            />

            <div className="thumb-info">
              <span className="thumb-title">Image Assigned</span>
              <span className="thumb-sub">Ready for registration</span>
            </div>

            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setCurrentStep('upload')}
            >
              Change Image
            </button>
          </div>

          {/* Core information */}
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Product Name <span className="req">*</span>
              </label>

              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="Enter product name"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="type" className="form-label">
                Product Category <span className="req">*</span>
              </label>

              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={(e) => {
                  handleFormChange(e)
                  setFormData((prev) => ({
                    ...prev,
                    category:
                      e.target.value === 'Pistol'
                        ? 'makanan'
                        : 'minuman',
                  }))
                }}
                className="form-select"
              >
                <option value="Pistol">Pistol</option>
                <option value="Rifle">Rifle</option>
                <option value="Shotgun">Shotgun</option>
                <option value="Submachine Gun">Submachine Gun</option>
              </select>
            </div>
          </div>

          <div className="form-grid form-grid--3">
            <div className="form-group">
              <label htmlFor="caliber" className="form-label">
                Model Specification
              </label>

              <input
                id="caliber"
                type="text"
                name="caliber"
                value={formData.caliber}
                onChange={handleFormChange}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="price" className="form-label">
                Price (USD)
              </label>

              <input
                id="price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleFormChange}
                min="0"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="difficulty" className="form-label">
                Grade
              </label>

              <select
                id="difficulty"
                name="difficulty"
                value={formData.difficulty}
                onChange={handleFormChange}
                className="form-select"
              >
                <option value="mudah">Standard</option>
                <option value="sedang">Service</option>
                <option value="sulit">Custom</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Description
            </label>

            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              rows={3}
              className="form-textarea"
              placeholder="Enter product description..."
            />
          </div>

          {/* Specifications */}
          <div className="form-fieldset">
            <div className="fieldset-header">
              <label className="form-label">Specifications</label>

              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={addSpec}
              >
                <Plus size={14} /> Add Spec
              </button>
            </div>

            <div className="multi-rows">
              {specs.map((spec, i) => (
                <div key={i} className="multi-row">
                  <input
                    type="text"
                    placeholder="Attribute"
                    value={spec.name}
                    onChange={(e) =>
                      handleSpecChange(i, 'name', e.target.value)
                    }
                    className="form-input"
                  />

                  <input
                    type="text"
                    placeholder="Value"
                    value={spec.quantity}
                    onChange={(e) =>
                      handleSpecChange(i, 'quantity', e.target.value)
                    }
                    className="form-input"
                  />

                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => removeSpec(i)}
                    disabled={specs.length <= 1}
                    title="Remove item"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Documentation steps */}
          <div className="form-fieldset">
            <div className="fieldset-header">
              <label className="form-label">Additional Information</label>

              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={addStep}
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="multi-rows">
              {steps.map((st, i) => (
                <div key={i} className="step-row">
                  <span className="step-num">{i + 1}</span>

                  <input
                    type="text"
                    placeholder="Enter additional information"
                    value={st}
                    onChange={(e) =>
                      handleStepChange(i, e.target.value)
                    }
                    className="form-input"
                  />

                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => removeStep(i)}
                    disabled={steps.length <= 1}
                    title="Remove item"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="checkbox-row">
            <input
              id="is_featured"
              type="checkbox"
              name="is_featured"
              checked={formData.is_featured}
              onChange={handleFormChange}
              className="form-checkbox"
            />

            <label htmlFor="is_featured" className="checkbox-label">
              Feature in catalog showcase
            </label>
          </div>

          {/* Submit */}
          <div className="form-actions-bar">
            <button
              type="button"
              className="btn btn--outline"
              onClick={onBack}
              disabled={creating}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn--primary"
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader size={18} className="spin" />
                  Saving…
                </>
              ) : (
                'Save Product'
              )}
            </button>
          </div>
        </form>
      )}

      {/* Restore draft */}
      <ConfirmModal
        open={showDraftModal}
        title="Resume Previous Draft?"
        message={`An unfinished draft from ${
          draftTimestamp
            ? formatDraftTime(draftTimestamp)
            : 'earlier'
        } was detected. Would you like to resume editing?`}
        confirmLabel="Load Draft"
        cancelLabel="Discard"
        onConfirm={handleLoadDraft}
        onCancel={handleDiscardDraft}
      />
    </div>
  )
}
