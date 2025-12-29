import { ref, nextTick } from 'vue'
import Cropper from 'cropperjs'

/**
 * Composable для управления аватаром пользователя
 *
 * Функционал:
 * - Загрузка и обрезка аватара через CropperJS
 * - Удаление аватара
 * - Получение URL аватара и инициалов
 */
export function useUserAvatar({ user, authStore, API_URL }) {
  // === State ===
  const avatarKey = ref(0) // Ключ для принудительной перерисовки аватарки
  const showCropper = ref(false)
  const selectedImageUrl = ref('')
  const cropperImage = ref(null)
  const uploadingAvatar = ref(false)
  const isAvatarEditMode = ref(false)

  // Cropper instance (не реактивный)
  let cropper = null

  // === Методы ===

  /**
   * Получить URL аватара
   */
  function getAvatarUrl(url) {
    if (!url) return ''
    if (url.startsWith('http')) return url
    return `${API_URL.replace('/api', '')}${url}`
  }

  /**
   * Получить инициалы из имени
   */
  function getInitials(name) {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  /**
   * Обработка выбора файла аватара
   */
  async function handleAvatarChange(event) {
    const file = event.target.files[0]
    if (!file) return

    selectedImageUrl.value = URL.createObjectURL(file)
    showCropper.value = true

    await nextTick()

    if (cropper) {
      cropper.destroy()
    }

    cropper = new Cropper(cropperImage.value, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1,
      responsive: true,
      background: false
    })
  }

  /**
   * Отмена обрезки
   */
  function cancelCrop() {
    if (cropper) {
      cropper.destroy()
      cropper = null
    }
    if (selectedImageUrl.value) {
      URL.revokeObjectURL(selectedImageUrl.value)
      selectedImageUrl.value = ''
    }
    showCropper.value = false
  }

  /**
   * Подтверждение обрезки и загрузка на сервер
   */
  async function confirmCrop() {
    if (!cropper) return

    uploadingAvatar.value = true

    try {
      const canvas = cropper.getCroppedCanvas({
        width: 400,
        height: 400,
        imageSmoothingQuality: 'high'
      })

      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('Ошибка создания изображения')
        }

        const formData = new FormData()
        formData.append('avatar', blob, 'avatar.jpg')

        const response = await fetch(`${API_URL}/profile/avatar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          },
          body: formData
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Ошибка загрузки')
        }

        // Обновляем аватар и увеличиваем ключ для перерисовки
        user.value.avatar_url = data.avatar_url
        authStore.user.avatar_url = data.avatar_url
        localStorage.setItem('user', JSON.stringify(authStore.user))

        // Увеличиваем ключ для принудительной перерисовки аватарки
        avatarKey.value++

        alert('Аватар успешно обновлен!')
        cancelCrop()

        // Закрываем режим редактирования аватара если он открыт
        if (isAvatarEditMode.value) {
          closeAvatarEdit()
        }
      }, 'image/jpeg', 0.95)
    } catch (err) {
      alert(err.message || 'Ошибка загрузки аватара')
    } finally {
      uploadingAvatar.value = false
    }
  }

  /**
   * Удаление аватара
   */
  async function handleAvatarDelete() {
    if (!confirm('Вы уверены, что хотите удалить аватар?')) return

    try {
      const response = await fetch(`${API_URL}/profile/avatar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка удаления аватара')
      }

      // Обновляем аватар и увеличиваем ключ для перерисовки
      user.value.avatar_url = null
      authStore.user.avatar_url = null
      localStorage.setItem('user', JSON.stringify(authStore.user))

      avatarKey.value++

      alert('Аватар успешно удален!')
    } catch (err) {
      alert(err.message || 'Ошибка удаления аватара')
    }
  }

  /**
   * Открыть режим редактирования аватара
   */
  function openAvatarEdit() {
    isAvatarEditMode.value = true
  }

  /**
   * Закрыть режим редактирования аватара
   */
  function closeAvatarEdit() {
    isAvatarEditMode.value = false
  }

  /**
   * Загрузить аватар и закрыть режим редактирования
   */
  async function handleAvatarChangeAndClose(event) {
    await handleAvatarChange(event)
  }

  /**
   * Удалить аватар и закрыть режим редактирования
   */
  async function handleAvatarDeleteAndClose() {
    await handleAvatarDelete()
    closeAvatarEdit()
  }

  /**
   * Установить ref на изображение cropper
   */
  function setCropperImageRef(el) {
    cropperImage.value = el
  }

  /**
   * Очистка ресурсов при размонтировании
   */
  function cleanup() {
    cancelCrop()
  }

  return {
    // State
    avatarKey,
    showCropper,
    selectedImageUrl,
    cropperImage,
    uploadingAvatar,
    isAvatarEditMode,

    // Methods
    getAvatarUrl,
    getInitials,
    handleAvatarChange,
    cancelCrop,
    confirmCrop,
    handleAvatarDelete,
    openAvatarEdit,
    closeAvatarEdit,
    handleAvatarChangeAndClose,
    handleAvatarDeleteAndClose,
    setCropperImageRef,
    cleanup
  }
}
